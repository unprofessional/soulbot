jest.mock('../features/openai/auth', () => ({ getAccessToken: jest.fn().mockResolvedValue('oauth-token') }));
const { generateText, listModels, readResponseStream } = require('../features/openai/inference');
const { isGeneralLlmInferenceEnabled } = require('../features/ollama/inference_gate');
const { usesChatGpt } = require('../features/openai/routing');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function stream(text, size = 7) {
    const bytes = new TextEncoder().encode(text);
    return new ReadableStream({
        start(controller) {
            for (let offset = 0; offset < bytes.length; offset += size) controller.enqueue(bytes.slice(offset, offset + size));
            controller.close();
        },
    });
}
const event = value => `data: ${JSON.stringify(value)}\r\n\r\n`;
const completed = event({ type: 'response.completed' });

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });

test('handles fragmented SSE, CRLF, comments and multibyte text until completion', async () => {
    const input = ': ping\r\n\r\n' + event({ type: 'response.output_text.delta', delta: 'Hello 🌎' }) + completed;
    await expect(readResponseStream(stream(input, 1))).resolves.toBe('Hello 🌎');
});

test.each(['response.failed', 'response.incomplete', 'error'])('rejects %s after partial output', async type => {
    const input = event({ type: 'response.output_text.delta', delta: 'partial' }) + event({ type });
    await expect(readResponseStream(stream(input))).rejects.toThrow(/failed or was incomplete/);
});

test('rejects truncated streams, even after receiving output or DONE', async () => {
    await expect(readResponseStream(stream(event({ type: 'response.output_text.delta', delta: 'partial' }) + 'data: [DONE]\n\n'))).rejects.toThrow(/before response.completed/);
});

test('preserves the safe usage-limit code without exposing remote error text', async () => {
    const body = stream(event({ type: 'error', code: 'subscription_sharing_usage_limit_exceeded', message: 'private remote details' }));
    await expect(readResponseStream(body)).rejects.toMatchObject({ code: 'subscription_sharing_usage_limit_exceeded' });
});

test('accepts completed final text and refusals', async () => {
    const body = stream(event({ type: 'response.completed', response: { output: [{ content: [{ type: 'refusal', refusal: 'Cannot help.' }] }] } }));
    await expect(readResponseStream(body)).resolves.toBe('Cannot help.');
});

test('sends OAuth bearer and required plan-usage fields, with per-task model', async () => {
    process.env.CHATGPT_MODEL = 'common-model';
    process.env.CHATGPT_SUMMARY_MODEL = 'summary-model';
    process.env.OPENAI_API_KEY = 'must-not-use';
    fetch.mockResolvedValue({ ok: true, body: stream(event({ type: 'response.output_text.delta', delta: 'summary' }) + completed) });
    await expect(generateText('summarize', 'summary')).resolves.toBe('summary');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers.Authorization).toBe('Bearer oauth-token');
    expect(JSON.parse(options.body)).toEqual({ model: 'summary-model', input: [{ role: 'user', content: 'summarize' }], store: false, stream: true });
});

test('sends role rewrite rules as separate instructions', async () => {
    process.env.CHATGPT_MODEL = 'model';
    fetch.mockResolvedValue({ ok: true, body: stream(event({ type: 'response.output_text.delta', delta: 'pleasant' }) + completed) });
    await expect(generateText('rude source', 'translation', { instructions: 'Rewrite pleasantly.' })).resolves.toBe('pleasant');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
        instructions: 'Rewrite pleasantly.',
        input: [{ role: 'user', content: 'rude source' }],
    });
});

test('quota failures do not retry or fall back', async () => {
    process.env.CHATGPT_MODEL = 'model';
    fetch.mockResolvedValue({ ok: false, status: 429 });
    await expect(generateText('prompt', 'summary')).rejects.toThrow(/No API-key fallback/);
    expect(fetch).toHaveBeenCalledTimes(1);
});

test('model listing uses the account-specific visible catalog', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ models: [{ slug: 'a', visibility: 'list' }, { slug: 'b', visibility: 'hidden' }] }) });
    expect(await listModels()).toEqual([{ slug: 'a', visibility: 'list' }]);
});

test('task opt-in does not enable GPU paths or other tasks', () => {
    process.env.GENERAL_LLM_INFERENCE_ENABLED = 'false';
    process.env.CHATGPT_TASKS = 'summary';
    expect(usesChatGpt('summary')).toBe(true);
    expect(isGeneralLlmInferenceEnabled('summary')).toBe(true);
    expect(isGeneralLlmInferenceEnabled('chat')).toBe(false);
    expect(isGeneralLlmInferenceEnabled()).toBe(false);
    expect(isGeneralLlmInferenceEnabled('vision')).toBe(false);
});

test('summary and chat wrappers route remotely while other generation stays disabled', async () => {
    process.env.GENERAL_LLM_INFERENCE_ENABLED = 'false';
    process.env.CHATGPT_TASKS = 'summary,chat';
    process.env.CHATGPT_MODEL = 'test-model';
    const ollama = require('../features/ollama');
    fetch.mockImplementation(async () => ({ ok: true, body: stream(event({ type: 'response.output_text.delta', delta: 'result' }) + completed) }));
    for (const run of [
        () => ollama.summarizeChat([]),
        () => ollama.summarizeSingleMessage({ content: 'hello' }),
        () => ollama.summarizeDeletedMessages({}),
        () => ollama.replyWithLlmContext({ userPrompt: 'hello' }),
        () => ollama.summarizeLlmMemory({ userPrompt: 'hello', assistantResponse: 'hi' }),
    ]) await expect(run()).resolves.toBe('result');
    expect(fetch).toHaveBeenCalledTimes(5);
    for (const [url, options] of fetch.mock.calls) {
        expect(url).toBe('https://api.openai.com/v1/responses');
        expect(JSON.parse(options.body).input[0].content).not.toContain('/no_think');
    }
    await expect(ollama.generateText('local')).rejects.toThrow(/disabled/);
    await expect(ollama.sendPromptToOllama('vision')).rejects.toThrow(/disabled/);
    expect(fetch).toHaveBeenCalledTimes(5);
});
