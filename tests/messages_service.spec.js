const mockFindAll = jest.fn();
const mockFindLatestChannelSummary = jest.fn();
const mockFindLatestChannelSummaries = jest.fn();
const mockFindRecentChannelMessagesIncludingDeleted = jest.fn();
const mockSave = jest.fn();
const mockFindByMessageId = jest.fn();

jest.mock('../features/twitter-core/render_ownership_registry.js', () => ({
    consumePendingRenderOwnership: jest.fn(),
}));

jest.mock('../store/dao/message.dao.js', () => {
    return jest.fn().mockImplementation(() => ({
        findAll: mockFindAll,
        findLatestChannelSummary: mockFindLatestChannelSummary,
        findLatestChannelSummaries: mockFindLatestChannelSummaries,
        findRecentChannelMessagesIncludingDeleted: mockFindRecentChannelMessagesIncludingDeleted,
        findByMessageId: mockFindByMessageId,
        save: mockSave,
    }));
});

jest.mock('../config/env_config.js', () => ({
    soulbotUserId: '891854264845094922',
}));

const {
    addMessage,
    getDeletedSummaryContext,
    getLlmChannelContext,
    getMessageById,
    getSummaryContext,
    getSummaryMessages,
    isExpectedDeletedMessage,
} = require('../store/services/messages.service');
const { consumePendingRenderOwnership } = require('../features/twitter-core/render_ownership_registry.js');

describe('messages service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindLatestChannelSummary.mockResolvedValue(null);
        mockSave.mockResolvedValue(true);
        consumePendingRenderOwnership.mockReturnValue(null);
    });

    test('getSummaryMessages requests only summary-safe fields and excludes non-text placeholders', async () => {
        mockFindAll.mockResolvedValue([
            { user_id: '2', content: 'later message' },
            { user_id: '1', content: 'earlier message' },
        ]);

        const messages = await getSummaryMessages({
            channelId: '1481343741712400506',
            limit: 100,
        });

        expect(mockFindAll).toHaveBeenCalledWith({
            channelId: '1481343741712400506',
            limit: 100,
            fields: ['user_id', 'content'],
            excludeUserId: '891854264845094922',
            excludeContent: '[Non-text message]',
            excludeContentPrefixes: ['**Summary:**'],
        });
        expect(messages).toEqual([
            { user_id: '1', content: 'earlier message' },
            { user_id: '2', content: 'later message' },
        ]);
    });

    test('getLlmChannelContext defaults to the latest 50 summary-safe channel messages', async () => {
        mockFindAll.mockResolvedValue([
            { user_id: '2', content: 'later message' },
            { user_id: '1', content: 'earlier message' },
        ]);

        const messages = await getLlmChannelContext({
            channelId: '1481343741712400506',
        });

        expect(mockFindAll).toHaveBeenCalledWith({
            channelId: '1481343741712400506',
            limit: 50,
            fields: ['user_id', 'content'],
            excludeUserId: '891854264845094922',
            excludeContent: '[Non-text message]',
            excludeContentPrefixes: ['**Summary:**'],
        });
        expect(messages).toEqual([
            { user_id: '1', content: 'earlier message' },
            { user_id: '2', content: 'later message' },
        ]);
    });

    test('getDeletedSummaryContext includes deleted rows but filters expected Twitter and SOULbot cleanup deletions', async () => {
        const createdAt = new Date('2026-04-18T12:00:00.000Z');
        mockFindRecentChannelMessagesIncludingDeleted.mockResolvedValue([
            {
                user_id: 'user-4',
                content: 'that insult was gross',
                created_at: new Date('2026-04-18T12:04:00.000Z'),
                deleted_at: null,
                meta: {},
            },
            {
                user_id: 'user-3',
                content: 'you fucking idiot',
                created_at: new Date('2026-04-18T12:03:00.000Z'),
                deleted_at: createdAt,
                meta: {},
            },
            {
                user_id: '891854264845094922',
                content: 'Uploading the rendered Twitter/X video...',
                created_at: new Date('2026-04-18T12:02:00.000Z'),
                deleted_at: createdAt,
                meta: {},
            },
            {
                user_id: 'user-2',
                content: 'https://x.com/example/status/123',
                created_at: new Date('2026-04-18T12:01:00.000Z'),
                deleted_at: createdAt,
                meta: {},
            },
            {
                user_id: 'user-1',
                content: 'what got deleted?',
                created_at: new Date('2026-04-18T12:00:00.000Z'),
                deleted_at: null,
                meta: {},
            },
        ]);

        const context = await getDeletedSummaryContext({
            channelId: '1481343741712400506',
            limit: 50,
        });

        expect(mockFindRecentChannelMessagesIncludingDeleted).toHaveBeenCalledWith(
            '1481343741712400506',
            50
        );
        expect(context).toEqual({
            messages: [
                { user_id: 'user-1', content: 'what got deleted?', deleted_at: null },
                { user_id: 'user-3', content: 'you fucking idiot', deleted_at: createdAt },
                { user_id: 'user-4', content: 'that insult was gross', deleted_at: null },
            ],
            deletedMessages: [
                { user_id: 'user-3', content: 'you fucking idiot', deleted_at: createdAt },
            ],
            ignoredDeletedCount: 2,
        });
    });

    test('isExpectedDeletedMessage only suppresses expected deletion patterns', () => {
        expect(isExpectedDeletedMessage({
            user_id: 'user-1',
            content: 'https://twitter.com/example/status/123',
            deleted_at: new Date('2026-04-18T12:00:00.000Z'),
        })).toBe(true);

        expect(isExpectedDeletedMessage({
            user_id: '891854264845094922',
            content: 'Encoding Twitter/X video... ██████ 50% (00:10 / 00:20)',
            deleted_at: new Date('2026-04-18T12:00:00.000Z'),
        })).toBe(true);

        expect(isExpectedDeletedMessage({
            user_id: 'user-2',
            content: 'this message was rude as hell',
            deleted_at: new Date('2026-04-18T12:00:00.000Z'),
        })).toBe(false);
    });

    test('getSummaryContext falls back to full mode when no prior summary exists', async () => {
        mockFindLatestChannelSummaries.mockResolvedValue([]);
        mockFindAll.mockResolvedValue([
            { user_id: '2', content: 'later message' },
            { user_id: '1', content: 'earlier message' },
        ]);

        const summaryContext = await getSummaryContext({
            channelId: '1481343741712400506',
            limit: 100,
        });

        expect(mockFindLatestChannelSummaries).toHaveBeenCalledWith(
            '1481343741712400506',
            '891854264845094922',
            3
        );
        expect(summaryContext).toEqual({
            mode: 'full',
            previousSummary: null,
            messages: [
                { user_id: '1', content: 'earlier message' },
                { user_id: '2', content: 'later message' },
            ],
            lastSummaryCreatedAt: null,
            summaryHistory: [],
        });
    });

    test('getSummaryContext returns delta mode with only newer meaningful messages', async () => {
        const createdAt = new Date('2026-04-07T12:00:00.000Z');
        mockFindLatestChannelSummaries.mockResolvedValue([{
            user_id: '891854264845094922',
            content: '**Summary:**\nold summary',
            created_at: createdAt,
        }]);
        mockFindAll.mockResolvedValue([
            { user_id: '2', content: 'later message' },
            { user_id: '1', content: 'earlier message' },
        ]);

        const summaryContext = await getSummaryContext({
            channelId: '1481343741712400506',
            limit: 100,
        });

        expect(mockFindAll).toHaveBeenCalledWith({
            channelId: '1481343741712400506',
            limit: 100,
            createdAfter: createdAt,
            fields: ['user_id', 'content'],
            excludeUserId: '891854264845094922',
            excludeContent: '[Non-text message]',
            excludeContentPrefixes: ['**Summary:**'],
        });
        expect(summaryContext).toEqual({
            mode: 'delta',
            previousSummary: '**Summary:**\nold summary',
            messages: [
                { user_id: '1', content: 'earlier message' },
                { user_id: '2', content: 'later message' },
            ],
            lastSummaryCreatedAt: createdAt,
            summaryHistory: [{
                content: '**Summary:**\nold summary',
                created_at: createdAt,
            }],
        });
    });

    test('getSummaryContext returns delta mode with zero messages when only noise followed the last summary', async () => {
        const createdAt = new Date('2026-04-07T12:00:00.000Z');
        mockFindLatestChannelSummaries.mockResolvedValue([{
            user_id: '891854264845094922',
            content: '**Summary:**\nold summary',
            created_at: createdAt,
        }]);
        mockFindAll.mockResolvedValue([]);

        const summaryContext = await getSummaryContext({
            channelId: '1481343741712400506',
            limit: 100,
        });

        expect(summaryContext).toEqual({
            mode: 'delta',
            previousSummary: '**Summary:**\nold summary',
            messages: [],
            lastSummaryCreatedAt: createdAt,
            summaryHistory: [{
                content: '**Summary:**\nold summary',
                created_at: createdAt,
            }],
        });
    });

    test('addMessage persists pending tweet render ownership into meta', async () => {
        consumePendingRenderOwnership.mockReturnValue({
            kind: 'twitter_render',
            owningUserId: 'user-1',
            originalMessageId: 'source-1',
            originalChannelId: 'channel-0',
            originalLink: 'https://x.com/example/status/1',
            threadId: 'thread-1',
        });

        await addMessage({
            id: 'message-1',
            webhookId: 'webhook-1',
            content: 'rendered tweet',
            createdTimestamp: Date.now(),
            author: {
                id: 'bot-user',
                username: 'Soulbot Webhook',
            },
            guild: {
                id: 'guild-1',
                name: 'Guild',
            },
            channel: {
                id: 'channel-1',
                name: 'general',
                isThread: jest.fn().mockReturnValue(false),
            },
            attachments: new Map(),
        });

        expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'bot-user',
            messageId: 'message-1',
            meta: expect.objectContaining({
                kind: 'twitter_render',
                owningUserId: 'user-1',
                originalMessageId: 'source-1',
                originalChannelId: 'channel-0',
                originalLink: 'https://x.com/example/status/1',
                threadId: 'thread-1',
            }),
        }));
    });

    test('getMessageById delegates to the DAO', async () => {
        mockFindByMessageId.mockResolvedValue({ message_id: 'abc' });

        await expect(getMessageById('abc')).resolves.toEqual({ message_id: 'abc' });
        expect(mockFindByMessageId).toHaveBeenCalledWith('abc');
    });
});
