const mockFindAll = jest.fn();
const mockFindLatestChannelSummary = jest.fn();

jest.mock('../store/dao/message.dao.js', () => {
    return jest.fn().mockImplementation(() => ({
        findAll: mockFindAll,
        findLatestChannelSummary: mockFindLatestChannelSummary,
    }));
});

jest.mock('../config/env_config.js', () => ({
    soulbotUserId: '891854264845094922',
}));

const {
    getSummaryContext,
    getSummaryMessages,
} = require('../store/services/messages.service');

describe('messages service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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

    test('getSummaryContext falls back to full mode when no prior summary exists', async () => {
        mockFindLatestChannelSummary.mockResolvedValue(null);
        mockFindAll.mockResolvedValue([
            { user_id: '2', content: 'later message' },
            { user_id: '1', content: 'earlier message' },
        ]);

        const summaryContext = await getSummaryContext({
            channelId: '1481343741712400506',
            limit: 100,
        });

        expect(mockFindLatestChannelSummary).toHaveBeenCalledWith(
            '1481343741712400506',
            '891854264845094922'
        );
        expect(summaryContext).toEqual({
            mode: 'full',
            previousSummary: null,
            messages: [
                { user_id: '1', content: 'earlier message' },
                { user_id: '2', content: 'later message' },
            ],
            lastSummaryCreatedAt: null,
        });
    });

    test('getSummaryContext returns delta mode with only newer meaningful messages', async () => {
        const createdAt = new Date('2026-04-07T12:00:00.000Z');
        mockFindLatestChannelSummary.mockResolvedValue({
            user_id: '891854264845094922',
            content: '**Summary:**\nold summary',
            created_at: createdAt,
        });
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
        });
    });

    test('getSummaryContext returns delta mode with zero messages when only noise followed the last summary', async () => {
        const createdAt = new Date('2026-04-07T12:00:00.000Z');
        mockFindLatestChannelSummary.mockResolvedValue({
            user_id: '891854264845094922',
            content: '**Summary:**\nold summary',
            created_at: createdAt,
        });
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
        });
    });
});
