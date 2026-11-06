jest.mock('../features/openai/inference', () => ({
    generateText: jest.fn(),
    getModel: jest.fn(() => 'gpt-6-luna'),
}));
const { generateText } = require('../features/openai/inference');
const { translateText, enrichMetadataWithTranslation, buildDisplayText, getApiTranslation } = require('../features/twitter-core/translation_service');
const { isGeneralLlmInferenceEnabled } = require('../features/ollama/inference_gate');
const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
    process.env.CHATGPT_TASKS = 'summary,chat,translation';
    process.env.GENERAL_LLM_INFERENCE_ENABLED = 'false';
    global.fetch = jest.fn();
    generateText.mockReset();
});
afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });

test('routes arbitrary language translation through ChatGPT without waking Ollama', async () => {
    generateText.mockResolvedValue('Bonjour le monde');
    await expect(translateText({ text: 'Hello world', sourceLanguage: 'en', targetLanguage: 'fr', log: jest.fn() })).resolves.toBe('Bonjour le monde');
    expect(generateText).toHaveBeenCalledWith(expect.stringContaining('English (en) to French (fr)'), 'translation');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(isGeneralLlmInferenceEnabled('translation')).toBe(true);
    expect(isGeneralLlmInferenceEnabled()).toBe(false);
});

test('does not fall back to Ollama when ChatGPT fails', async () => {
    generateText.mockRejectedValue(new Error('quota exceeded'));
    await expect(translateText({ text: 'Bonjour', sourceLanguage: 'fr' })).rejects.toThrow('quota exceeded');
    expect(global.fetch).not.toHaveBeenCalled();
});

test('rejects empty translations', async () => {
    generateText.mockResolvedValue('  ');
    await expect(translateText({ text: 'Bonjour', sourceLanguage: 'fr' })).rejects.toThrow(/empty translation/);
});

test('keeps existing metadata API translations without consuming credits', async () => {
    const metadata = { text: 'こんにちは', lang: 'ja', translation: { text: 'Hello' } };
    await enrichMetadataWithTranslation(metadata, jest.fn());
    expect(metadata.translatedText).toBe('Hello');
    expect(generateText).not.toHaveBeenCalled();
});

test('stores Luna fallback attribution and reuses it on repeated enrichment', async () => {
    const metadata = { text: '今日は良い天気ですね', lang: 'ja', translation: null };
    generateText.mockResolvedValue('The weather is nice today.');
    await enrichMetadataWithTranslation(metadata, jest.fn());
    expect(metadata.translation).toMatchObject({ provider: 'chatgpt-missing-api', model: 'gpt-6-luna' });
    expect(getApiTranslation(metadata)).toBeNull();
    expect(buildDisplayText(metadata)).toContain('[Translated from Japanese]\nThe weather is nice today.');
    await enrichMetadataWithTranslation(metadata, jest.fn());
    expect(generateText).toHaveBeenCalledTimes(1);
});

test('tweet rendering keeps original text on a failed inference', async () => {
    const metadata = { text: '今日は良い天気ですね', lang: 'ja', translation: null };
    generateText.mockRejectedValue(new Error('quota exceeded'));
    await enrichMetadataWithTranslation(metadata, jest.fn());
    expect(buildDisplayText(metadata)).toBe(metadata.text);
    expect(global.fetch).not.toHaveBeenCalled();
});
