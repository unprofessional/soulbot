const mockRenderProfileCanvas = jest.fn();
const mockGetGreetingChannelId = jest.fn();
const mockRecordMemberEntry = jest.fn();
const mockRecordMemberExit = jest.fn();
const mockCaptureStickyRoles = jest.fn();
const mockRestoreStickyRoles = jest.fn();

jest.mock('discord.js', () => ({
    Events: {
        GuildMemberAdd: 'guildMemberAdd',
        GuildMemberRemove: 'guildMemberRemove',
    },
}));

jest.mock('../features/discord-profile/render_profile_canvas.js', () => ({
    renderProfileCanvas: mockRenderProfileCanvas,
}));

jest.mock('../store/guilds.js', () => ({
    getGreetingChannelId: mockGetGreetingChannelId,
}));

jest.mock('../store/member_events.js', () => ({
    recordMemberEntry: mockRecordMemberEntry,
    recordMemberExit: mockRecordMemberExit,
}));

jest.mock('../store/sticky_roles.js', () => ({
    captureStickyRoles: mockCaptureStickyRoles,
    restoreStickyRoles: mockRestoreStickyRoles,
}));

const {
    initializeGuildMemberAdd,
    ordinal,
} = require('../events/guild_member_add.js');
const { initializeGuildMemberRemove } = require('../events/guild_member_remove.js');

describe('guild member greeting events', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRecordMemberEntry.mockResolvedValue(1);
        mockRecordMemberExit.mockResolvedValue({ event_type: 'leave' });
        mockCaptureStickyRoles.mockResolvedValue([]);
        mockRestoreStickyRoles.mockResolvedValue([]);
    });

    test.each([
        [1, '1st'],
        [2, '2nd'],
        [3, '3rd'],
        [4, '4th'],
        [11, '11th'],
        [12, '12th'],
        [13, '13th'],
        [21, '21st'],
    ])('formats join count %i as %s', (count, expected) => {
        expect(ordinal(count)).toBe(expected);
    });

    test('member add stays silent when no greeting channel is configured', async () => {
        mockGetGreetingChannelId.mockResolvedValue(null);
        const handlers = {};
        const client = {
            on: jest.fn((event, handler) => {
                handlers[event] = handler;
            }),
        };

        initializeGuildMemberAdd(client);

        await handlers.guildMemberAdd({
            user: {
                id: 'user-1',
            },
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map(),
                    fetch: jest.fn(),
                },
            },
        });

        expect(mockRecordMemberEntry).toHaveBeenCalled();
        expect(mockRestoreStickyRoles).toHaveBeenCalled();
        expect(mockRenderProfileCanvas).not.toHaveBeenCalled();
    });

    test('member add renders into the configured guild channel', async () => {
        mockGetGreetingChannelId.mockResolvedValue('channel-1');
        const channel = {
            guildId: 'guild-1',
            isTextBased: jest.fn().mockReturnValue(true),
        };
        const handlers = {};
        const client = {
            on: jest.fn((event, handler) => {
                handlers[event] = handler;
            }),
        };

        initializeGuildMemberAdd(client);

        const guildMember = {
            user: {
                id: 'user-1',
            },
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map([['channel-1', channel]]),
                    fetch: jest.fn(),
                },
            },
        };

        await handlers.guildMemberAdd(guildMember);

        expect(mockRecordMemberEntry).toHaveBeenCalledWith(guildMember);
        expect(mockRenderProfileCanvas).toHaveBeenCalledWith(guildMember, channel, {
            content: 'Welcome <@user-1>',
        });
    });

    test('member re-entry includes the join ordinal with the card', async () => {
        mockGetGreetingChannelId.mockResolvedValue('channel-1');
        mockRecordMemberEntry.mockResolvedValue(2);
        const channel = {
            guildId: 'guild-1',
            isTextBased: jest.fn().mockReturnValue(true),
        };
        const handlers = {};
        const client = {
            on: jest.fn((event, handler) => {
                handlers[event] = handler;
            }),
        };
        const guildMember = {
            user: { id: 'user-1' },
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map([['channel-1', channel]]),
                    fetch: jest.fn(),
                },
            },
        };

        initializeGuildMemberAdd(client);
        await handlers.guildMemberAdd(guildMember);

        expect(mockRenderProfileCanvas).toHaveBeenCalledWith(guildMember, channel, {
            content: "Welcome <@user-1>\nThis is the 2nd time you've joined this server.",
        });
    });

    test('sticky-role restoration failure does not block the welcome', async () => {
        mockGetGreetingChannelId.mockResolvedValue('channel-1');
        mockRestoreStickyRoles.mockRejectedValue(new Error('missing permission'));
        const channel = {
            guildId: 'guild-1',
            isTextBased: jest.fn().mockReturnValue(true),
        };
        const handlers = {};
        const client = {
            on: jest.fn((event, handler) => { handlers[event] = handler; }),
        };
        const guildMember = {
            user: { id: 'user-1' },
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map([['channel-1', channel]]),
                    fetch: jest.fn(),
                },
            },
        };
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        initializeGuildMemberAdd(client);
        await handlers.guildMemberAdd(guildMember);

        expect(mockRenderProfileCanvas).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            '[sticky-roles] Failed to restore member roles:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    test('member remove posts only into the configured guild channel', async () => {
        mockGetGreetingChannelId.mockResolvedValue('channel-1');
        const send = jest.fn();
        const channel = {
            guildId: 'guild-1',
            isTextBased: jest.fn().mockReturnValue(true),
            send,
        };
        const handlers = {};
        const client = {
            on: jest.fn((event, handler) => {
                handlers[event] = handler;
            }),
        };

        initializeGuildMemberRemove(client);

        await handlers.guildMemberRemove({
            user: {
                id: 'user-1',
                username: 'obiwan',
            },
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map([['channel-1', channel]]),
                    fetch: jest.fn(),
                },
            },
        });

        expect(mockRecordMemberExit).toHaveBeenCalled();
        expect(mockCaptureStickyRoles).toHaveBeenCalled();
        expect(send).toHaveBeenCalledWith('`obiwan` left the server!');
    });

    test('sticky-role capture failure does not block the departure announcement', async () => {
        mockGetGreetingChannelId.mockResolvedValue('channel-1');
        mockCaptureStickyRoles.mockRejectedValue(new Error('database unavailable'));
        const send = jest.fn();
        const channel = {
            guildId: 'guild-1',
            isTextBased: jest.fn().mockReturnValue(true),
            send,
        };
        const handlers = {};
        const client = {
            on: jest.fn((event, handler) => { handlers[event] = handler; }),
        };
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        initializeGuildMemberRemove(client);
        await handlers.guildMemberRemove({
            user: { id: 'user-1', username: 'obiwan' },
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map([['channel-1', channel]]),
                    fetch: jest.fn(),
                },
            },
        });

        expect(send).toHaveBeenCalledWith('`obiwan` left the server!');
        expect(errorSpy).toHaveBeenCalledWith(
            '[sticky-roles] Failed to capture member roles:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });
});
