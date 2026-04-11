const mockRenderProfileCanvas = jest.fn();
const mockGetGreetingChannelId = jest.fn();

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

const { initializeGuildMemberAdd } = require('../events/guild_member_add.js');
const { initializeGuildMemberRemove } = require('../events/guild_member_remove.js');

describe('guild member greeting events', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map(),
                    fetch: jest.fn(),
                },
            },
        });

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
            guild: {
                id: 'guild-1',
                channels: {
                    cache: new Map([['channel-1', channel]]),
                    fetch: jest.fn(),
                },
            },
        };

        await handlers.guildMemberAdd(guildMember);

        expect(mockRenderProfileCanvas).toHaveBeenCalledWith(guildMember, channel);
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

        expect(send).toHaveBeenCalledWith('`obiwan` left the server!');
    });
});
