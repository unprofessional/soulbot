const mockQuery = jest.fn();

jest.mock('../store/db/pool.js', () => ({
    pool: {
        query: mockQuery,
    },
}));

const MemberEventDAO = require('../store/dao/member_event.dao.js');

describe('MemberEventDAO', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('inserts an event and returns the resulting join count', async () => {
        mockQuery.mockResolvedValue({
            rows: [{
                guild_id: 'guild-1',
                member_id: 'user-1',
                event_type: 'join',
                join_count: 2,
            }],
        });
        const dao = new MemberEventDAO();

        await expect(dao.record({
            guildId: 'guild-1',
            memberId: 'user-1',
            eventType: 'join',
            username: 'member',
            globalName: 'Global Name',
            displayName: 'Guild Display',
        })).resolves.toMatchObject({ join_count: 2 });

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO member_guild_event'),
            ['guild-1', 'user-1', 'join', 'member', 'Global Name', 'Guild Display']
        );
    });
});
