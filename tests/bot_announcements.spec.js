const mockGetBotAnnouncementChannels = jest.fn();

jest.mock('../store/guilds.js', () => ({
    getBotAnnouncementChannels: mockGetBotAnnouncementChannels,
}));

const {
    RESTART_ANNOUNCEMENT,
    announceBotRestart,
    resolveAnnouncementChannel,
} = require('../app/bot_announcements.js');

describe('bot announcements', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('announceBotRestart sends the restart message to configured channels', async () => {
        const send = jest.fn().mockResolvedValue({});
        const channel = {
            guildId: 'guild-1',
            isTextBased: jest.fn().mockReturnValue(true),
            send,
        };
        const client = createClient({
            guilds: new Map([
                ['guild-1', createGuild('guild-1', new Map([
                    ['channel-1', channel],
                ]))],
            ]),
        });
        mockGetBotAnnouncementChannels.mockResolvedValue([
            { guildId: 'guild-1', channelId: 'channel-1' },
        ]);

        await expect(announceBotRestart(client)).resolves.toEqual({
            sent: 1,
            failed: 0,
            skipped: 0,
        });
        expect(send).toHaveBeenCalledWith(RESTART_ANNOUNCEMENT);
    });

    test('announceBotRestart skips when the client is not ready', async () => {
        const client = {
            isReady: jest.fn().mockReturnValue(false),
        };

        await expect(announceBotRestart(client)).resolves.toEqual({
            sent: 0,
            failed: 0,
            skipped: 0,
        });
        expect(mockGetBotAnnouncementChannels).not.toHaveBeenCalled();
    });

    test('resolveAnnouncementChannel fetches uncached guild and channel', async () => {
        const channel = {
            guildId: 'guild-1',
            isTextBased: jest.fn().mockReturnValue(true),
        };
        const guild = createGuild('guild-1', new Map(), channel);
        const client = createClient({
            guilds: new Map(),
            fetchedGuild: guild,
        });

        await expect(resolveAnnouncementChannel(client, {
            guildId: 'guild-1',
            channelId: 'channel-1',
        })).resolves.toBe(channel);
        expect(client.guilds.fetch).toHaveBeenCalledWith('guild-1');
        expect(guild.channels.fetch).toHaveBeenCalledWith('channel-1');
    });
});

function createClient({ guilds, fetchedGuild = null }) {
    return {
        isReady: jest.fn().mockReturnValue(true),
        guilds: {
            cache: {
                get: jest.fn((guildId) => guilds.get(guildId)),
            },
            fetch: jest.fn().mockResolvedValue(fetchedGuild),
        },
    };
}

function createGuild(guildId, channels, fetchedChannel = null) {
    return {
        id: guildId,
        channels: {
            cache: {
                get: jest.fn((channelId) => channels.get(channelId)),
            },
            fetch: jest.fn().mockResolvedValue(fetchedChannel),
        },
    };
}
