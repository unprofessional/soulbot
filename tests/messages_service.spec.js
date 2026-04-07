const mockFindAll = jest.fn();

jest.mock('../store/dao/message.dao.js', () => {
    return jest.fn().mockImplementation(() => ({
        findAll: mockFindAll,
    }));
});

jest.mock('../config/env_config.js', () => ({
    soulbotUserId: '891854264845094922',
}));

const {
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
});
