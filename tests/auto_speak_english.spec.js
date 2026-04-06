jest.mock('../features/twitter-core/translation_service.js', () => ({
    improveEnglishText: jest.fn(),
    normalizeWhitespace: jest.requireActual('../features/twitter-core/translation_service.js').normalizeWhitespace,
}));

const {
    clearCooldowns,
    handleSpeakEnglishRole,
    hasQualifyingText,
    hasSpeakEnglishRole,
    isOnCooldown,
    markCooldown,
    stripDisqualifyingContent,
    shouldProcessMessage,
} = require('../features/translation/auto_speak_english.js');
const { improveEnglishText } = require('../features/twitter-core/translation_service.js');

describe('auto speak-english role handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        clearCooldowns();
    });

    test('detects the speak-english role by name', () => {
        expect(hasSpeakEnglishRole({
            roles: {
                cache: new Map([
                    ['1', { name: 'speak-english' }],
                ]),
                map(fn) {
                    return Array.from(this.cache.values()).map(fn);
                },
            },
        })).toBe(true);
    });

    test('ignores empty or too-short messages', () => {
        expect(shouldProcessMessage({
            author: { bot: false },
            guild: {},
            content: 'hi',
        })).toBe(false);
        expect(shouldProcessMessage({
            author: { bot: false },
            guild: {},
            content: 'this is fine',
        })).toBe(true);
    });

    test('ignores messages that are only links or only code blocks', () => {
        expect(stripDisqualifyingContent('https://example.com')).toBe('');
        expect(stripDisqualifyingContent('```js\nconst x = 1;\n```')).toBe('');
        expect(hasQualifyingText('https://example.com')).toBe(false);
        expect(hasQualifyingText('```js\nconst x = 1;\n```')).toBe(false);
        expect(hasQualifyingText('please fix this https://example.com')).toBe(true);
        expect(hasQualifyingText('this code is bad ```js\nconst x = 1;\n```')).toBe(true);
    });

    test('replies with improved English for users with the speak-english role', async () => {
        improveEnglishText.mockResolvedValue('I am going to the store later.');

        const reply = jest.fn().mockResolvedValue(undefined);
        const message = {
            author: { bot: false, id: '123' },
            guild: { members: { fetch: jest.fn() } },
            member: {
                roles: {
                    cache: new Map([['1', { name: 'speak-english' }]]),
                    map(fn) {
                        return Array.from(this.cache.values()).map(fn);
                    },
                },
            },
            content: 'im goin to stor later',
            reply,
        };

        await handleSpeakEnglishRole(message);

        expect(improveEnglishText).toHaveBeenCalledWith(expect.objectContaining({
            text: 'im goin to stor later',
        }));
        expect(reply).toHaveBeenCalledWith({
            content: 'Proper English:\nI am going to the store later.',
            allowedMentions: { repliedUser: false },
        });
    });

    test('does not reply when the improved English matches the original text', async () => {
        improveEnglishText.mockResolvedValue('hello there');

        const reply = jest.fn().mockResolvedValue(undefined);
        const message = {
            author: { bot: false, id: '123' },
            guild: { members: { fetch: jest.fn() } },
            member: {
                roles: {
                    cache: new Map([['1', { name: 'speak-english' }]]),
                    map(fn) {
                        return Array.from(this.cache.values()).map(fn);
                    },
                },
            },
            content: 'hello there',
            reply,
        };

        await handleSpeakEnglishRole(message);

        expect(reply).not.toHaveBeenCalled();
    });

    test('rate limits replies to once every five seconds per user', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-06T12:00:00Z'));

        improveEnglishText.mockResolvedValue('I am going to the store later.');

        const reply = jest.fn().mockResolvedValue(undefined);
        const message = {
            author: { bot: false, id: '123' },
            guild: { members: { fetch: jest.fn() } },
            member: {
                roles: {
                    cache: new Map([['1', { name: 'speak-english' }]]),
                },
            },
            content: 'im goin to stor later',
            reply,
        };

        await handleSpeakEnglishRole(message);
        expect(reply).toHaveBeenCalledTimes(1);
        expect(isOnCooldown('123')).toBe(true);

        await handleSpeakEnglishRole(message);
        expect(reply).toHaveBeenCalledTimes(1);

        jest.setSystemTime(new Date('2026-04-06T12:00:06Z'));
        expect(isOnCooldown('123')).toBe(false);

        improveEnglishText.mockResolvedValue('I am going to the store later again.');
        await handleSpeakEnglishRole(message);
        expect(reply).toHaveBeenCalledTimes(2);

        markCooldown('manual-user');
        expect(isOnCooldown('manual-user')).toBe(true);
    });
});
