const mockDelete = jest.fn();
const mockExists = jest.fn();
const mockFindAll = jest.fn();
const mockFindByGuildId = jest.fn();
const mockSave = jest.fn();
const mockUpdateMeta = jest.fn();

jest.mock('../store/dao/guild.dao.js', () => {
    return jest.fn().mockImplementation(() => ({
        delete: mockDelete,
        exists: mockExists,
        findAll: mockFindAll,
        findByGuildId: mockFindByGuildId,
        save: mockSave,
        updateMeta: mockUpdateMeta,
    }));
});

const {
    addGuild,
    clearBotAnnouncementChannelId,
    clearGreetingChannelId,
    getBotAnnouncementChannelId,
    getBotAnnouncementChannels,
    getGreetingChannelId,
    guildIsSupported,
    setBotAnnouncementChannelId,
    setGreetingChannelId,
} = require('../store/guilds.js');

describe('guild store helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindByGuildId.mockResolvedValue(null);
        mockUpdateMeta.mockResolvedValue(true);
    });

    test('getGreetingChannelId returns null when guild meta is empty', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {},
        });

        await expect(getGreetingChannelId('guild-1')).resolves.toBeNull();
    });

    test('setGreetingChannelId persists the greeting channel into guild meta', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {
                foo: 'bar',
            },
        });

        await expect(setGreetingChannelId('guild-1', 'channel-1')).resolves.toBe('channel-1');
        expect(mockUpdateMeta).toHaveBeenCalledWith('guild-1', {
            foo: 'bar',
            greetingChannelId: 'channel-1',
        });
    });

    test('getBotAnnouncementChannelId returns null when guild meta is empty', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {},
        });

        await expect(getBotAnnouncementChannelId('guild-1')).resolves.toBeNull();
    });

    test('setBotAnnouncementChannelId persists the bot announcement channel into guild meta', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {
                supported: true,
            },
        });

        await expect(setBotAnnouncementChannelId('guild-1', 'channel-1')).resolves.toBe('channel-1');
        expect(mockUpdateMeta).toHaveBeenCalledWith('guild-1', {
            supported: true,
            botAnnouncementChannelId: 'channel-1',
        });
    });

    test('clearBotAnnouncementChannelId removes the bot announcement channel while preserving other meta', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {
                botAnnouncementChannelId: 'channel-1',
                supported: true,
            },
        });

        await clearBotAnnouncementChannelId('guild-1');
        expect(mockUpdateMeta).toHaveBeenCalledWith('guild-1', {
            supported: true,
        });
    });

    test('getBotAnnouncementChannels returns configured guild/channel pairs', async () => {
        mockFindAll.mockResolvedValue([
            {
                guild_id: 'guild-1',
                meta: {
                    botAnnouncementChannelId: 'channel-1',
                },
            },
            {
                guild_id: 'guild-2',
                meta: {},
            },
        ]);

        await expect(getBotAnnouncementChannels()).resolves.toEqual([
            {
                guildId: 'guild-1',
                channelId: 'channel-1',
            },
        ]);
    });

    test('clearGreetingChannelId removes the greeting channel while preserving other meta', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {
                foo: 'bar',
                greetingChannelId: 'channel-1',
            },
        });

        await clearGreetingChannelId('guild-1');
        expect(mockUpdateMeta).toHaveBeenCalledWith('guild-1', {
            foo: 'bar',
        });
    });

    test('guildIsSupported stays false for greeting-only guild rows', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {
                greetingChannelId: 'channel-1',
            },
        });

        await expect(guildIsSupported('guild-1')).resolves.toBe(false);
    });

    test('addGuild marks an existing guild row as supported', async () => {
        mockFindByGuildId.mockResolvedValue({
            guild_id: 'guild-1',
            meta: {
                greetingChannelId: 'channel-1',
            },
        });

        await expect(addGuild('guild-1')).resolves.toEqual({
            ok: true,
            message: 'Adding server to the list...',
        });
        expect(mockUpdateMeta).toHaveBeenCalledWith('guild-1', {
            greetingChannelId: 'channel-1',
            supported: true,
        });
    });
});
