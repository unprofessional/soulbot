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

    test('shouldTranslateMetadata only enables API-surfaced translations', () => {
        const { shouldTranslateMetadata } = loadServiceWithEnv();

        expect(shouldTranslateMetadata({
            text: 'ola',
            lang: 'pt',
            translation: { text: 'hello' },
        })).toBe(true);
        expect(shouldTranslateMetadata({ text: 'ola', lang: 'pt', translation: null })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'hello', lang: 'en' })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'bonjour', lang: null })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'https://t.co/abcdef', lang: 'pt' })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'video only', lang: 'zxx' })).toBe(false);
    });

    test('hasMissingApiTranslation detects non-English posts without API translation', () => {
        const {
            hasMissingApiTranslation,
            isWeakMissingTranslationSource,
            shouldInferMissingApiTranslation,
        } = loadServiceWithEnv();

        const japanesePost = {
            tweetID: '2054042128062525820',
            text: '中国の地方のライブ',
            lang: 'ja',
            translation: null,
        };
        const weakSignalPost = {
            text: 'LMAOOOO',
            lang: 'ht',
            translation: null,
        };
        const spanishPost = {
            tweetID: '2055816539174040015',
            text: 'Un tribunal francés dictamina que Ousmane Diallo no puede ser considerado penalmente responsable del asesinato.',
            lang: 'es',
            translation: null,
        };
        const frenchPost = {
            tweetID: '2055696364265423140',
            text: 'Ce coréen a copieusement insulté les Blancs dans l’un de ses streams.',
            lang: 'fr',
            translation: null,
        };
        const plainLatinSpanishPost = {
            tweetID: 'plain-es',
            text: 'Un tribunal dicta sentencia sobre un asesinato durante uno de sus primeros dias de trabajo.',
            lang: 'es',
            translation: null,
        };
        const syntheticLanguagePost = {
            tweetID: 'qht-post',
            text: '#東京 #速報 #事件',
            lang: 'qht',
            translation: null,
        };

        expect(hasMissingApiTranslation(japanesePost)).toBe(true);
        expect(isWeakMissingTranslationSource(japanesePost)).toBe(false);
        expect(shouldInferMissingApiTranslation(japanesePost)).toBe(true);
        expect(hasMissingApiTranslation(spanishPost)).toBe(true);
        expect(shouldInferMissingApiTranslation(spanishPost)).toBe(true);
        expect(hasMissingApiTranslation(frenchPost)).toBe(true);
        expect(shouldInferMissingApiTranslation(frenchPost)).toBe(true);
        expect(hasMissingApiTranslation(plainLatinSpanishPost)).toBe(true);
        expect(shouldInferMissingApiTranslation(plainLatinSpanishPost)).toBe(true);
        expect(hasMissingApiTranslation(syntheticLanguagePost)).toBe(true);
        expect(shouldInferMissingApiTranslation(syntheticLanguagePost)).toBe(true);
        expect(hasMissingApiTranslation(weakSignalPost)).toBe(true);
        expect(isWeakMissingTranslationSource(weakSignalPost)).toBe(true);
        expect(shouldInferMissingApiTranslation(weakSignalPost)).toBe(false);
        expect(hasMissingApiTranslation({
            text: 'hello',
            lang: 'en',
            translation: null,
        })).toBe(false);
        expect(hasMissingApiTranslation({
            text: 'video only',
            lang: 'zxx',
            translation: null,
        })).toBe(false);
        expect(hasMissingApiTranslation({
            text: 'ola',
            lang: 'pt',
            translation: { text: 'hello' },
        })).toBe(false);
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

    test('buildDisplayText appends API-surfaced translated English copy', () => {
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

    test('buildDisplayText ignores internal Ollama translations and missing API translations', () => {
        const { buildDisplayText } = loadServiceWithEnv();

        expect(buildDisplayText({
            text: 'LMAOOOO',
            lang: 'ht',
            translation: null,
        })).toBe('LMAOOOO');

        expect(buildDisplayText({
            text: 'LMAOOOO',
            lang: 'ht',
            translation: {
                provider: 'ollama',
                sourceLanguage: 'ht',
                text: 'LOL (Laughing Out Loud)',
            },
        })).toBe('LMAOOOO');
    });

    test('buildDisplayText renders missing-API fallback translations', () => {
        const { buildDisplayText } = loadServiceWithEnv();

        const rendered = buildDisplayText({
            text: '中国の地方のライブ',
            lang: 'ja',
            translation: {
                provider: 'ollama-missing-api',
                sourceLanguage: 'ja',
                text: 'A local live show in China.',
            },
        });

        expect(rendered).toContain('[Translated from Japanese]');
        expect(rendered).toContain('A local live show in China.');
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

    test('translateMetadataBatchToEnglish applies existing API translations and guarded fallbacks', async () => {
        const { translateMetadataBatchToEnglish } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: 'A local live show in China.',
            }),
        });

        const posts = [
            { tweetID: '1', lang: 'pt', text: 'ola mundo', translation: { text: 'Hello world' } },
            { tweetID: '2', lang: 'es', text: 'buenos dias', translation: { text: 'Good morning' } },
            { tweetID: '3', lang: 'ht', text: 'LMAOOOO', translation: null },
            { tweetID: '4', lang: 'ja', text: '中国の地方のライブ', translation: null },
            { tweetID: '5', lang: 'es', text: 'Un tribunal francés dictamina que Ousmane no puede ser considerado penalmente responsable.', translation: null },
        ];

        await translateMetadataBatchToEnglish(posts, jest.fn());

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(posts[0].translatedText).toBe('Hello world');
        expect(posts[1].translatedText).toBe('Good morning');
        expect(posts[2].translatedText).toBeUndefined();
        expect(posts[3].translatedText).toBe('A local live show in China.');
        expect(posts[4].translatedText).toBe('A local live show in China.');
    });

    test('translateMetadataBatchToEnglish does not generate translations for weak Twitter synthetic lang codes', async () => {
        const { translateMetadataBatchToEnglish } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });

        global.fetch = jest.fn();

        const posts = [
            { tweetID: '1', lang: 'qst', text: 'N' },
        ];

        await translateMetadataBatchToEnglish(posts, jest.fn());

        expect(global.fetch).not.toHaveBeenCalled();
        expect(posts[0].translatedText).toBeUndefined();
    });

    test('enrichMetadataWithTranslation stores API translated text on metadata', async () => {
        const { enrichMetadataWithTranslation } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
            OLLAMA_HOST: 'ollama-service',
            OLLAMA_PORT: '11434',
        });

        global.fetch = jest.fn();

        const metadata = {
            tweetID: '123',
            lang: 'pt',
            text: 'Charlie Sheen farmou muita aura nesse comercial de cigarro japonês dos anos 90',
            translation: {
                text: 'Charlie Sheen created a lot of aura in this 90s Japanese cigarette commercial.',
            },
        };

        await enrichMetadataWithTranslation(metadata, jest.fn());

        expect(global.fetch).not.toHaveBeenCalled();
        expect(metadata.translatedText).toBe('Charlie Sheen created a lot of aura in this 90s Japanese cigarette commercial.');
        expect(metadata.translation).toEqual(expect.objectContaining({
            provider: 'api',
            sourceLanguage: 'pt',
            destinationLanguage: 'en',
        }));
    });

    test('enrichMetadataWithTranslation leaves metadata untouched when API translation is absent', async () => {
        const { enrichMetadataWithTranslation } = loadServiceWithEnv();
        global.fetch = jest.fn();
        const log = jest.fn();

        const metadata = {
            tweetID: '2053349312910840242',
            lang: 'ht',
            text: 'LMAOOOO',
            translation: null,
        };

        await enrichMetadataWithTranslation(metadata, log);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith('[translation] missing API translation for non-English tweet 2053349312910840242 (ht); skipping model fallback because the source text signal is weak');
        expect(metadata).toEqual({
            tweetID: '2053349312910840242',
            lang: 'ht',
            text: 'LMAOOOO',
            translation: null,
        });
    });

    test('enrichMetadataWithTranslation generates fallback translation for strong non-English text', async () => {
        const { enrichMetadataWithTranslation, buildDisplayText } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });
        const log = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: 'A local live show in China introduced seismic isolation devices because the venue audience was not lively enough.',
            }),
        });

        const metadata = {
            tweetID: '2054042128062525820',
            lang: 'ja',
            text: '中国の地方のライブ、会場のノリが悪いから免震装置を導入されたのまだ面白い',
            translation: null,
        };

        await enrichMetadataWithTranslation(metadata, log);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(global.fetch.mock.calls[0][1].body).prompt).toContain('Japanese (ja) to English (en)');
        expect(metadata.translation).toEqual(expect.objectContaining({
            provider: 'ollama-missing-api',
            model: 'translategemma:12b',
            sourceLanguage: 'ja',
            destinationLanguage: 'en',
        }));
        expect(buildDisplayText(metadata)).toContain('[Translated from Japanese]');
        expect(buildDisplayText(metadata)).toContain('A local live show in China introduced seismic isolation devices');
    });

    test('enrichMetadataWithTranslation generates fallback translation for Latin-script text with diacritics', async () => {
        const { enrichMetadataWithTranslation, buildDisplayText } = loadServiceWithEnv({
            OLLAMA_TRANSLATION_MODEL: 'translategemma:12b',
        });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                response: 'A French court ruled that Ousmane Diallo cannot be held criminally responsible.',
            }),
        });

        const metadata = {
            tweetID: '2055816539174040015',
            lang: 'es',
            text: 'Un tribunal francés dictamina que Ousmane Diallo no puede ser considerado penalmente responsable del asesinato.',
            translation: null,
        };

        await enrichMetadataWithTranslation(metadata, jest.fn());

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(global.fetch.mock.calls[0][1].body).prompt).toContain('Spanish (es) to English (en)');
        expect(metadata.translation).toEqual(expect.objectContaining({
            provider: 'ollama-missing-api',
            sourceLanguage: 'es',
            destinationLanguage: 'en',
        }));
        expect(buildDisplayText(metadata)).toContain('[Translated from Spanish]');
        expect(buildDisplayText(metadata)).toContain('A French court ruled');
    });
});
