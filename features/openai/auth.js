const { randomBytes, createHash } = require('node:crypto');
const http = require('node:http');
const { withStore } = require('./store');

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const TOKEN_URL = `${ISSUER}/api/accounts/oauth/token`;
const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const SCOPES = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
const random = () => randomBytes(32).toString('base64url');
let jwks;

function profileName() {
    return process.env.CHATGPT_PROFILE || 'default';
}

async function discovery() {
    const response = await fetch(`${ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('OpenAI identity discovery failed.');
    const metadata = await response.json();
    if (metadata.issuer !== ISSUER) throw new Error('Unexpected OpenAI identity issuer.');
    return metadata;
}

function trustedAuthUrl(value) {
    const url = new URL(value);
    if (url.origin !== ISSUER) throw new Error('Unexpected OpenAI identity endpoint.');
    return url;
}

async function verifyIdentity(idToken, clientId, nonce) {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    if (!jwks) jwks = createRemoteJWKSet(trustedAuthUrl((await discovery()).jwks_uri));
    const { payload } = await jwtVerify(idToken, jwks, {
        issuer: ISSUER,
        audience: clientId,
        requiredClaims: ['sub', 'exp', 'iat'],
        clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || !payload.sub || (nonce !== undefined && payload.nonce !== nonce)) {
        throw new Error('OpenAI identity or nonce did not match.');
    }
    return payload;
}

async function requestTokens(parameters) {
    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...parameters, resource: RESOURCE }),
        signal: AbortSignal.timeout(15000),
    });
    // Do not include remote response bodies or credentials in logs/errors.
    if (!response.ok) throw new Error(`ChatGPT authorization failed (HTTP ${response.status}). Run npm run chatgpt:auth -- login to reconnect.`);
    return response.json();
}

function applyTokens(account, tokens, { refresh = false } = {}) {
    const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : (refresh ? account.scopes : []);
    if (!scopes?.includes(PLAN_SCOPE) || !scopes.includes('resource.invoke')) {
        throw new Error('ChatGPT plan usage was not authorized. Enable it in ChatGPT Settings → Usage and sign in again.');
    }
    if (!tokens.access_token || tokens.token_type?.toLowerCase() !== 'bearer'
        || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) {
        throw new Error('Invalid OpenAI token response.');
    }
    return {
        ...account,
        scopes,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || (refresh ? account.refresh_token : undefined),
        id_token: tokens.id_token || (refresh ? account.id_token : undefined),
        expires_at: Date.now() + tokens.expires_in * 1000,
    };
}

function createAuthorization({ hostId, account, redirectUri }) {
    const state = random();
    const nonce = random();
    const verifier = random();
    const url = new URL(`${ISSUER}/api/accounts/authorize`);
    url.search = new URLSearchParams({
        client_id: account?.client_id || 'dynamic_agent_client',
        ...(account ? {} : { agent_name_hint: 'SOULbot' }),
        ext_agent_host_id: hostId,
        response_type: 'code', redirect_uri: redirectUri,
        scope: SCOPES, resource: RESOURCE, state, nonce,
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    }).toString();
    // Intentionally omit id_token_hint: this URL is printed for manual browser use.
    return { url: url.toString(), state, nonce, verifier, redirectUri, account };
}

async function completeAuthorization(attempt, parameters, verify = verifyIdentity) {
    if (parameters.get('state') !== attempt.state) throw new Error('OAuth state did not match.');
    if (parameters.has('error')) throw new Error('ChatGPT sign-in was declined or failed.');
    const code = parameters.get('code');
    const clientId = parameters.get('client_id') || attempt.account?.client_id;
    if (!code || !clientId || clientId === 'dynamic_agent_client'
        || (attempt.account && clientId !== attempt.account.client_id)) {
        throw new Error('Missing or mismatched OAuth registration.');
    }
    const tokens = await requestTokens({
        grant_type: 'authorization_code', client_id: clientId, code,
        code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri,
    });
    const identity = await verify(tokens.id_token, clientId, attempt.nonce);
    if (attempt.account && identity.sub !== attempt.account.subject) {
        throw new Error('Signed-in identity does not match this saved profile. Use a new profile name for another account.');
    }
    return applyTokens({ client_id: clientId, subject: identity.sub, email: identity.email, issuer: ISSUER }, tokens);
}

async function login(name = profileName(), onReady = console.log) {
    const { hostId, account } = await withStore(async store => ({ hostId: store.hostId, account: store.accounts[name] }));
    const port = Number(process.env.CHATGPT_CALLBACK_PORT || 1455);
    let attempt;
    let busy = false;
    let timer;
    let server;
    try {
        await new Promise((resolve, reject) => {
            server = http.createServer(async (request, response) => {
                const url = new URL(request.url, 'http://127.0.0.1');
                response.setHeader('Cache-Control', 'no-store');
                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                if (request.method !== 'GET' || url.pathname !== '/auth/callback') {
                    response.writeHead(404).end();
                    return;
                }
                if (!attempt || busy || url.searchParams.get('state') !== attempt.state) {
                    response.writeHead(400).end('Invalid or already used sign-in attempt.');
                    return;
                }
                busy = true;
                clearTimeout(timer);
                try {
                    const result = await completeAuthorization(attempt, url.searchParams);
                    await withStore(async (store, save) => {
                        if (JSON.stringify(store.accounts[name]) !== JSON.stringify(account)) {
                            throw new Error('Profile changed during sign-in. Please retry.');
                        }
                        store.accounts[name] = result;
                        await save();
                    });
                    response.end('SOULbot is connected. You can close this tab.');
                    resolve();
                } catch (error) {
                    response.writeHead(400).end('Sign-in failed. Check the SOULbot terminal.');
                    reject(error);
                }
            });
            server.on('error', reject);
            server.listen(port, '127.0.0.1', () => {
                attempt = createAuthorization({ hostId, account, redirectUri: `http://127.0.0.1:${server.address().port}/auth/callback` });
                onReady(`Continue with ChatGPT:\n${attempt.url}`);
            });
            timer = setTimeout(() => reject(new Error('ChatGPT sign-in timed out. Please retry.')), 300000);
        });
    } finally {
        clearTimeout(timer);
        server?.close();
        server?.closeAllConnections();
    }
}

async function getAccessToken(name = profileName()) {
    return withStore(async (store, save) => {
        let account = store.accounts[name];
        if (!account?.access_token || !account.scopes?.includes(PLAN_SCOPE)) {
            throw new Error(`ChatGPT profile "${name}" is not connected. Run npm run chatgpt:auth -- login ${name}.`);
        }
        if (!Number.isFinite(account.expires_at) || account.expires_at <= Date.now() + 60000) {
            if (!account.refresh_token) throw new Error('ChatGPT session expired. Sign in again.');
            const tokens = await requestTokens({ grant_type: 'refresh_token', client_id: account.client_id, refresh_token: account.refresh_token });
            if (tokens.id_token) {
                const identity = await verifyIdentity(tokens.id_token, account.client_id);
                if (identity.sub !== account.subject) throw new Error('Refreshed ChatGPT identity did not match.');
            }
            account = applyTokens(account, tokens, { refresh: true });
            store.accounts[name] = account;
            await save();
        }
        return account.access_token;
    });
}

async function logout(name = profileName()) {
    return withStore(async (store, save) => {
        const account = store.accounts[name];
        if (!account) return true;
        let revoked = !account.refresh_token;
        try {
            if (account.refresh_token) {
                const endpoint = trustedAuthUrl((await discovery()).revocation_endpoint);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ token: account.refresh_token, token_type_hint: 'refresh_token', client_id: account.client_id }),
                    signal: AbortSignal.timeout(15000),
                });
                revoked = response.status === 200;
            }
        } catch { revoked = false; }
        for (const key of ['access_token', 'refresh_token', 'id_token', 'expires_at', 'scopes']) delete account[key];
        await save();
        return revoked;
    });
}

module.exports = { applyTokens, completeAuthorization, createAuthorization, getAccessToken, login, logout, profileName, verifyIdentity };
