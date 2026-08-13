const mockQuery = jest.fn();

jest.mock('../store/db/pool.js', () => ({
    pool: { query: mockQuery },
}));

const MessageDAO = require('../store/dao/message.dao.js');

describe('X render count query', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('counts successful owned render deliveries globally and includes deleted rows', async () => {
        const cutoff = new Date('2026-08-05T12:00:00.000Z');
        mockQuery.mockResolvedValue({ rows: [{ count: 4 }] });

        const dao = new MessageDAO();
        await expect(dao.countSuccessfulTwitterRendersByUser('user-1', cutoff))
            .resolves.toBe(4);

        const [sql, params] = mockQuery.mock.calls[0];
        expect(params).toEqual(['user-1', cutoff]);
        expect(sql).toContain("meta->>'kind' = 'twitter_render'");
        expect(sql).toContain("meta->>'owningUserId' = $1");
        expect(sql).toContain("meta->>'originalLink' IS NOT NULL");
        expect(sql).toContain('cardinality(attachments) > 0');
        expect(sql).toContain('created_at >= $2');
        expect(sql).not.toContain('guild_id');
        expect(sql).not.toContain('deleted_at');
    });
});
