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

    test('shouldTranslateMetadata only enables translation for non-English posts when key is configured', () => {
        const { shouldTranslateMetadata } = loadServiceWithEnv({ OPENAI_API_KEY: 'test-key' });

        expect(shouldTranslateMetadata({ text: 'ola', lang: 'pt' })).toBe(true);
        expect(shouldTranslateMetadata({ text: 'hello', lang: 'en' })).toBe(false);
        expect(shouldTranslateMetadata({ text: 'bonjour', lang: null })).toBe(false);
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
        expect(rendered).toContain('[Translated from PT]');
        expect(rendered).toContain('Charlie Sheen farmed a lot of aura in this commercial.');
    });

    test('enrichMetadataWithTranslation stores translated text on metadata', async () => {
        const { enrichMetadataWithTranslation } = loadServiceWithEnv({
            OPENAI_API_KEY: 'test-key',
            OPENAI_TRANSLATION_MODEL: 'gpt-5-mini',
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({
                output_text: 'Charlie Sheen created a lot of aura in this 90s Japanese cigarette commercial.',
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
            provider: 'openai',
            model: 'gpt-5-mini',
            sourceLanguage: 'pt',
            destinationLanguage: 'en',
        }));
    });
});
