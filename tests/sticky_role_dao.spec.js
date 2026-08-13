const mockQuery = jest.fn();

jest.mock('../store/db/pool.js', () => ({ pool: { query: mockQuery } }));

const StickyRoleDAO = require('../store/dao/sticky_role.dao.js');

describe('StickyRoleDAO', () => {
    beforeEach(() => jest.clearAllMocks());

    test('persists a member-specific assignment idempotently', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ role_id: 'role-1' }] });
        const dao = new StickyRoleDAO();
        await expect(dao.addAssignment('guild-1', 'user-1', 'role-1'))
            .resolves.toBe(true);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT (guild_id, member_id, role_id) DO NOTHING'),
            ['guild-1', 'user-1', 'role-1']
        );
    });

    test('removes only the selected member-role binding', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ role_id: 'role-1' }] });
        const dao = new StickyRoleDAO();
        await expect(dao.removeAssignment('guild-1', 'user-1', 'role-1'))
            .resolves.toBe(true);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('member_id = $2 AND role_id = $3'),
            ['guild-1', 'user-1', 'role-1']
        );
    });
});
