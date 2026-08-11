const mockRecord = jest.fn();

jest.mock('../store/dao/member_event.dao.js', () => {
    return jest.fn().mockImplementation(() => ({
        record: mockRecord,
    }));
});

const {
    memberEventIdentity,
    recordMemberEntry,
    recordMemberExit,
} = require('../store/member_events.js');

function guildMember() {
    return {
        displayName: 'Guild Display',
        guild: { id: 'guild-1' },
        user: {
            id: 'user-1',
            username: 'member',
            globalName: 'Global Name',
        },
    };
}

describe('member event storage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('normalizes the current guild identity snapshot', () => {
        expect(memberEventIdentity(guildMember())).toEqual({
            guildId: 'guild-1',
            memberId: 'user-1',
            username: 'member',
            globalName: 'Global Name',
            displayName: 'Guild Display',
        });
    });

    test('records an entry and returns its per-guild join count', async () => {
        mockRecord.mockResolvedValue({ join_count: 3 });

        await expect(recordMemberEntry(guildMember())).resolves.toBe(3);
        expect(mockRecord).toHaveBeenCalledWith({
            guildId: 'guild-1',
            memberId: 'user-1',
            username: 'member',
            globalName: 'Global Name',
            displayName: 'Guild Display',
            eventType: 'join',
        });
    });

    test('records an exit with the same identity snapshot', async () => {
        mockRecord.mockResolvedValue({ event_type: 'leave' });

        await expect(recordMemberExit(guildMember())).resolves.toEqual({ event_type: 'leave' });
        expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({
            guildId: 'guild-1',
            memberId: 'user-1',
            eventType: 'leave',
        }));
    });
});
