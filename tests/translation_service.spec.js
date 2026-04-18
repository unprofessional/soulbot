const envPath = require.resolve('../config/env_config.js');
const servicePath = require.resolve('../features/twitter-core/translation_service.js');

function loadServiceWithEnv(env = {}) {
    jest.resetModules();

    const originalEnv = { ...process.env };
    Object.assign(process.env, env);

    delete require.cache[envPath];
    delete require.cache[servicePath];

    const service = require('../features/twitter-core/translation_service.js');

    process.env = originalEnv;

    return service;
}

describe('translation_service', () => {
    afterEach(() => {
        delete global.fetch;
        jest.restoreAllMocks();
    });

    test('shouldTranslateMetadata only enables translation for non-English posts', () => {
        const { shouldTranslateMetadata } = loadServiceWithEnv();

        expect(shouldTranslateMetadata({ text: 'ola', lang: 'pt' })).toBe(true);
        expect(shouldTranslateMetadata({ text: 'hello', lang: 'en' })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'bonjour', lang: null })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'https://t.co/abcdef', lang: 'pt' })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'video only', lang: 'zxx' })).toBe(false);
    });

    test('buildTranslateGemmaPrompt matches the expected translation template shape', () => {
        const { buildTranslateGemmaPrompt } = loadServiceWithEnv();

        const prompt = buildTranslateGemmaPrompt({
            text: 'Guten Morgen, wie geht es Ihnen?',
            sourceLanguage: 'de',
            targetLanguage: 'en',
        });

        expect(prompt).toContain('You are a professional German (de) to English (en) translator.');
        expect(prompt).toContain('Please translate the following German text into English:');
        expect(prompt).toContain('\n\n\nGuten Morgen, wie geht es Ihnen?');
    });

    test('buildTranslateGemmaPrompt treats Twitter synthetic lang codes as content classifications', () => {
        const { buildTranslateGemmaPrompt } = loadServiceWithEnv();

        const prompt = buildTranslateGemmaPrompt({
            text: 'N',
            sourceLanguage: 'qst',
            targetLanguage: 'en',
        });

        expect(prompt).toContain('working from X/Twitter posts into English (en)');
        expect(prompt).toContain('very short text (qst), which is a Twitter-specific content classification rather than a real language code');
        expect(prompt).toContain('Infer the actual source language from the text itself');
    });

    test('resolveLanguageCode supports language names and explicit codes', () => {
        const { resolveLanguageCode } = loadServiceWithEnv();

        expect(resolveLanguageCode('French')).toBe('fr');
        expect(resolveLanguageCode('Chinese Simplified')).toBe('zh-Hans');
        expect(resolveLanguageCode('pt-BR')).toBe('pt-BR');
        expect(resolveLanguageCode('not-a-real-language')).toBeNull();
    });

    test('buildDisplayText appends the translated English copy', () => {
        const { buildDisplayText } = loadServiceWithEnv();

        const rendered = buildDisplayText({
            text: 'Charlie Sheen farmou muita aura nesse comercial',
            lang: 'pt',
            translation: {
                sourceLanguage: 'pt',
                text: 'Charlie Sheen farmed a lot of aura in this commercial.',
            },
        });

        expect(rendered).toContain('Charlie Sheen farmou muita aura nesse comercial');
        expect(rendered).toContain('[Translated from Portuguese]');
        expect(rendered).toContain('Charlie Sheen farmed a lot of aura in this commercial.');
    });

    test('buildDisplayText uses friendly names for Twitter synthetic lang codes', () => {
        const { buildDisplayText } = loadServiceWithEnv();

        const rendered = buildDisplayText({
            text: 'N',
            lang: 'qst',
            translation: {
                sourceLanguage: 'qst',
                text: 'N.',
            },
        });

        expect(rendered).toContain('[Translated from very short text]');
        expect(rendered).toContain('N.');
    });

    test('buildDisplayText returns empty string when the source text is effectively empty', () => {
        const { buildDisplayText } = loadServiceWithEnv();

        expect(buildDisplayText({
            text: 'https://t.co/abcdef',
            lang: 'zxx',
            translatedText: 'Refusal text that should not render',
        })).toBe('');
    });

    test('translateTextToEnglish rejects refusal-style non-translation responses', async () => {
        const { translateTextToEnglish } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: 'I am unable to access external URLs, including the one provided. Please provide the text you would like me to translate.',
            }),
        });

        await expect(translateTextToEnglish({
            text: 'ola',
            sourceLanguage: 'pt',
            log: jest.fn(),
        })).rejects.toThrow('non-translation response');
    });

    test('translateText supports arbitrary target languages', async () => {
        const { translateText } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: 'Bonjour tout le monde',
            }),
        });

        const translated = await translateText({
            text: 'Hello everyone',
            sourceLanguage: 'en',
            targetLanguage: 'fr',
            log: jest.fn(),
        });

        expect(translated).toBe('Bonjour tout le monde');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual(expect.objectContaining({
            model: 'translategemma:12b',
            prompt: expect.stringContaining('English (en) to French (fr)'),
        }));
    });

    test('translateMetadataBatchToEnglish applies one batched translation response across multiple posts', async () => {
        const { translateMetadataBatchToEnglish } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: JSON.stringify([
                    { id: '1', translation: 'Hello world' },
                    { id: '2', translation: 'Good morning' },
                ]),
            }),
        });

        const posts = [
            { tweetID: '1', lang: 'pt', text: 'ola mundo' },
            { tweetID: '2', lang: 'es', text: 'buenos dias' },
        ];

        await translateMetadataBatchToEnglish(posts, jest.fn());

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(posts[0].translatedText).toBe('Hello world');
        expect(posts[1].translatedText).toBe('Good morning');
    });

    test('translateMetadataBatchToEnglish annotates Twitter synthetic lang codes in batch prompts', async () => {
        const { translateMetadataBatchToEnglish } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: JSON.stringify([
                    { id: '1', translation: 'N.' },
                ]),
            }),
        });

        const posts = [
            { tweetID: '1', lang: 'qst', text: 'N' },
        ];

        await translateMetadataBatchToEnglish(posts, jest.fn());

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(global.fetch.mock.calls[0][1].body).prompt).toContain('Twitter-specific classification, not a real language code');
    });

    test('enrichMetadataWithTranslation stores translated text on metadata', async () => {
        const { enrichMetadataWithTranslation } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
            OLLAMA_HOST: 'ollama-service',
            OLLAMA_PORT: '11434',
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: 'Charlie Sheen created a lot of aura in this 90s Japanese cigarette commercial.',
            }),
        });

        const metadata = {
            tweetID: '123',
            lang: 'pt',
            text: 'Charlie Sheen farmou muita aura nesse comercial de cigarro japonês dos anos 90',
        };

        await enrichMetadataWithTranslation(metadata, jest.fn());

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(metadata.translatedText).toBe('Charlie Sheen created a lot of aura in this 90s Japanese cigarette commercial.');
        expect(metadata.translation).toEqual(expect.objectContaining({
            provider: 'ollama',
            model: 'translategemma:12b',
            sourceLanguage: 'pt',
            destinationLanguage: 'en',
        }));
    });
});
