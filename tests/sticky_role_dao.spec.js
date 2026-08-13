const mockQuery = jest.fn();

jest.mock('../store/db/pool.js', () => ({
    pool: { query: mockQuery },
}));

const StickyRoleDAO = require('../store/dao/sticky_role.dao.js');

describe('StickyRoleDAO', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('adds configured roles idempotently', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ role_id: 'role-1' }] });
        const dao = new StickyRoleDAO();

        await expect(dao.addConfiguredRole('guild-1', 'role-1')).resolves.toBe(true);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT (guild_id, role_id) DO NOTHING'),
            ['guild-1', 'role-1']
        );
    });

    test('replaces a member snapshot in one query', async () => {
        mockQuery.mockResolvedValue({ rows: [{ role_id: 'role-1' }] });
        const dao = new StickyRoleDAO();

        await expect(dao.replaceMemberSnapshot(
            'guild-1', 'user-1', ['role-1']
        )).resolves.toEqual(['role-1']);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM member_sticky_role'),
            ['guild-1', 'user-1', ['role-1']]
        );
    });
});
