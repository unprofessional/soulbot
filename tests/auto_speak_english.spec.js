jest.mock('../features/twitter-core/webhook_utils.js', () => ({
    sendWebhookReplacementBatch: jest.fn(),
}));

jest.mock('../features/twitter-core/translation_service.js', () => ({
    improveEnglishText: jest.fn(),
    normalizeWhitespace: jest.requireActual('../features/twitter-core/translation_service.js').normalizeWhitespace,
}));

const {
    buildBucketId,
    clearPendingBuffers,
    flushPendingBucket,
    getPendingBucket,
    handleSpeakEnglishRole,
    hasQualifyingText,
    hasSpeakEnglishRole,
    stripDisqualifyingContent,
    shouldProcessMessage,
} = require('../features/translation/auto_speak_english.js');
const { sendWebhookReplacementBatch } = require('../features/twitter-core/webhook_utils.js');
const { improveEnglishText } = require('../features/twitter-core/translation_service.js');

describe('auto speak-english role handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        clearPendingBuffers();
    });

    afterEach(() => {
        clearPendingBuffers();
        jest.useRealTimers();
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

    test('ignores empty messages but allows short non-empty messages', () => {
        expect(shouldProcessMessage({
            author: { bot: false },
            guild: {},
            content: '',
        })).toBe(false);
        expect(shouldProcessMessage({
            author: { bot: false },
            guild: {},
            content: 'this is fine',
        })).toBe(true);
        expect(shouldProcessMessage({
            author: { bot: false },
            guild: {},
            content: 'Huh',
        })).toBe(true);
        expect(shouldProcessMessage({
            author: { bot: false },
            guild: {},
            content: '???',
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
        };

        await handleSpeakEnglishRole(message);

        const bucketId = buildBucketId(message);
        expect(getPendingBucket(message)).toEqual(expect.objectContaining({
            messages: [message],
        }));

        await flushPendingBucket(bucketId);

        expect(improveEnglishText).toHaveBeenCalledWith(expect.objectContaining({
            text: 'im goin to stor later',
        }));
        expect(sendWebhookReplacementBatch).toHaveBeenCalledWith(
            [message],
            'I am going to the store later.'
        );
    });

    test('does not reply when the improved English matches the original text', async () => {
        improveEnglishText.mockResolvedValue('hello there');

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
        };

        await handleSpeakEnglishRole(message);
        await flushPendingBucket(buildBucketId(message));

        expect(sendWebhookReplacementBatch).not.toHaveBeenCalled();
    });

    test('buffers multiple messages inside the five second window and sends one combined replacement', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-06T12:00:00Z'));

        improveEnglishText.mockResolvedValue('I am going to the store later.\nAlso, I forgot the milk.');

        const makeMessage = (id, content) => ({
            author: { bot: false, id: '123' },
            client: { user: { id: 'bot-1' } },
            guild: { members: { fetch: jest.fn() } },
            guildId: 'guild-1',
            channelId: 'channel-1',
            member: {
                roles: {
                    cache: new Map([['1', { name: 'speak-english' }]]),
                },
            },
            channel: {
                isThread: () => false,
                fetchWebhooks: jest.fn(),
            },
            id,
            content,
            delete: jest.fn().mockResolvedValue(undefined),
        });

        const messageOne = makeMessage('m1', 'im goin to stor later');
        const messageTwo = makeMessage('m2', 'also forgot milk');

        await handleSpeakEnglishRole(messageOne);
        await handleSpeakEnglishRole(messageTwo);

        const bucket = getPendingBucket(messageOne);
        expect(bucket.messages).toEqual([messageOne, messageTwo]);

        await jest.advanceTimersByTimeAsync(5000);

        expect(improveEnglishText).toHaveBeenCalledWith(expect.objectContaining({
            text: 'im goin to stor later\nalso forgot milk',
        }));
        expect(sendWebhookReplacementBatch).toHaveBeenCalledWith(
            [messageOne, messageTwo],
            'I am going to the store later.\nAlso, I forgot the milk.'
        );
        expect(getPendingBucket(messageOne)).toBeNull();
    });

    test('keeps buffers isolated per user per channel', async () => {
        const messageA = {
            author: { bot: false, id: '123' },
            guild: { members: { fetch: jest.fn() } },
            guildId: 'guild-1',
            channelId: 'channel-1',
            member: { roles: { cache: new Map([['1', { name: 'speak-english' }]]) } },
            content: 'helo',
        };
        const messageB = {
            author: { bot: false, id: '123' },
            guild: { members: { fetch: jest.fn() } },
            guildId: 'guild-1',
            channelId: 'channel-2',
            member: { roles: { cache: new Map([['1', { name: 'speak-english' }]]) } },
            content: 'wrld',
        };

        await handleSpeakEnglishRole(messageA);
        await handleSpeakEnglishRole(messageB);

        expect(getPendingBucket(messageA)).toBeTruthy();
        expect(getPendingBucket(messageB)).toBeTruthy();
        expect(buildBucketId(messageA)).not.toBe(buildBucketId(messageB));
    });
});
