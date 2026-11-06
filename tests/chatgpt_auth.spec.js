const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { withStore } = require('../features/openai/store');
const { applyTokens, completeAuthorization, createAuthorization, getAccessToken, logout } = require('../features/openai/auth');

const scopes = 'openid resource.invoke chatgpt.tokens.use.direct offline_access';
const tokens = () => ({ access_token: 'access', refresh_token: 'refresh', id_token: 'identity', token_type: 'Bearer', expires_in: 3600, scope: scopes });
let directory;
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soulbot-oauth-test-'));
    process.env.CHATGPT_AUTH_DIR = directory;
    process.env.CHATGPT_PROFILE = 'default';
    global.fetch = jest.fn();
});
afterEach(async () => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    await fs.rm(directory, { recursive: true, force: true });
});

test('authorization uses fresh state/nonce, S256, loopback callback, and a stable registered client', () => {
    const options = { hostId: 'urn:uuid:test', redirectUri: 'http://127.0.0.1:1455/auth/callback' };
    const attempt = createAuthorization(options);
    const url = new URL(attempt.url);
    expect(url.searchParams.get('client_id')).toBe('dynamic_agent_client');
    expect(url.searchParams.get('agent_name_hint')).toBe('SOULbot');
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(attempt.verifier).digest('base64url'));
    const returning = createAuthorization({ ...options, account: { client_id: 'issued', id_token: 'secret' } });
    expect(returning.state).not.toBe(attempt.state);
    expect(returning.nonce).not.toBe(attempt.nonce);
    expect(new URL(returning.url).searchParams.get('client_id')).toBe('issued');
    expect(returning.url).not.toContain('secret');
    expect(returning.url).not.toContain('agent_name_hint');
});

test.each([
    ['state=wrong&code=abc&client_id=issued', /state/],
    ['state=valid&error=access_denied', /declined/],
    ['state=valid&code=abc', /registration/],
    ['state=valid&code=abc&client_id=dynamic_agent_client', /registration/],
])('rejects invalid callback without exchanging tokens: %s', async (query, message) => {
    await expect(completeAuthorization({ state: 'valid' }, new URLSearchParams(query))).rejects.toThrow(message);
    expect(fetch).not.toHaveBeenCalled();
});

test('exchanges with issued client ID and validates identity before accepting plan scopes', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => tokens() });
    const verify = jest.fn().mockResolvedValue({ sub: 'subject', email: 'test@example.com' });
    const attempt = { state: 'valid', verifier: 'verifier', nonce: 'nonce', redirectUri: 'http://127.0.0.1:1455/auth/callback' };
    const account = await completeAuthorization(attempt, new URLSearchParams('state=valid&code=abc&client_id=issued'), verify);
    expect(verify).toHaveBeenCalledWith('identity', 'issued', 'nonce');
    expect(fetch.mock.calls[0][1].body.get('client_id')).toBe('issued');
    expect(fetch.mock.calls[0][1].body.get('code_verifier')).toBe('verifier');
    expect(account.subject).toBe('subject');
    expect(account.scopes).toContain('chatgpt.tokens.use.direct');
    expect(() => applyTokens({}, { ...tokens(), scope: 'openid' })).toThrow(/not authorized/);
});

test('returning profile rejects changed client or account identity', async () => {
    const attempt = { state: 'valid', account: { client_id: 'issued', subject: 'original' } };
    await expect(completeAuthorization(attempt, new URLSearchParams('state=valid&code=abc&client_id=other'))).rejects.toThrow(/registration/);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue({ ok: true, json: async () => tokens() });
    await expect(completeAuthorization(attempt, new URLSearchParams('state=valid&code=abc'), async () => ({ sub: 'other' }))).rejects.toThrow(/identity/);
});

test('persists stable host identity and owner-only credentials', async () => {
    const hostId = await withStore(async (store, save) => {
        store.accounts.default = { client_id: 'issued' };
        await save();
        return store.hostId;
    });
    expect(await withStore(async store => store.hostId)).toBe(hostId);
    expect((await fs.stat(path.join(directory, 'accounts.json'))).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(directory)).toEqual(['accounts.json']);
});

test('concurrent requests serialize refresh and persist rotated refresh token', async () => {
    await withStore(async (store, save) => {
        store.accounts.default = { ...applyTokens({ client_id: 'issued' }, tokens()), expires_at: 0 };
        await save();
    });
    fetch.mockResolvedValue({ ok: true, json: async () => ({ ...tokens(), id_token: undefined, access_token: 'new-access', refresh_token: 'rotated' }) });
    expect(await Promise.all([getAccessToken(), getAccessToken()])).toEqual(['new-access', 'new-access']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].body.get('grant_type')).toBe('refresh_token');
    expect(fetch.mock.calls[0][1].body.has('scope')).toBe(false);
    expect(await withStore(async store => store.accounts.default.refresh_token)).toBe('rotated');
});

test('refresh failure does not destroy stored session or expose response body', async () => {
    await withStore(async (store, save) => {
        store.accounts.default = { ...applyTokens({ client_id: 'issued' }, tokens()), expires_at: 0 };
        await save();
    });
    fetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'secret-token' });
    await expect(getAccessToken()).rejects.toThrow(/HTTP 401/);
    expect(await withStore(async store => store.accounts.default.refresh_token)).toBe('refresh');
});

test('logout clears local credentials even when remote revocation fails, retaining registration', async () => {
    await withStore(async (store, save) => {
        store.accounts.default = applyTokens({ client_id: 'issued', subject: 'subject' }, tokens());
        await save();
    });
    fetch.mockRejectedValue(new Error('offline'));
    expect(await logout()).toBe(false);
    expect(await withStore(async store => store.accounts.default)).toEqual({ client_id: 'issued', subject: 'subject' });
    await expect(getAccessToken()).rejects.toThrow(/not connected/);
});

test('real JWT verification rejects invalid signatures, issuer, audience, expiry, nonce, and missing subject', () => {
    // Run ESM jose in native Node, outside Jest's CommonJS VM. Network is mocked.
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { generateKeyPair, exportJWK, SignJWT } from 'jose';
        import auth from './features/openai/auth.js';
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const wrong = await generateKeyPair('RS256');
        const jwk = { ...await exportJWK(publicKey), kid: 'test', alg: 'RS256' };
        globalThis.fetch = async url => new Response(JSON.stringify(
            String(url).includes('openid-configuration')
                ? { issuer: 'https://auth.openai.com', jwks_uri: 'https://auth.openai.com/keys' }
                : { keys: [jwk] }
        ), { headers: { 'content-type': 'application/json' } });
        const claims = { iss: 'https://auth.openai.com', aud: 'issued', sub: 'subject', nonce: 'nonce', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+60 };
        const sign = (changes = {}, key = privateKey) => new SignJWT({ ...claims, ...changes }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(key);
        assert.equal((await auth.verifyIdentity(await sign(), 'issued', 'nonce')).sub, 'subject');
        for (const changes of [{iss:'wrong'}, {aud:'other'}, {exp:1}, {nonce:'wrong'}, {sub:undefined}]) {
            await assert.rejects(auth.verifyIdentity(await sign(changes), 'issued', 'nonce'));
        }
        await assert.rejects(auth.verifyIdentity(await sign({}, wrong.privateKey), 'issued', 'nonce'));
    `], { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
});
