const mockClearBotAnnouncementChannelId = jest.fn();
const mockGetBotAnnouncementChannelId = jest.fn();
const mockSetBotAnnouncementChannelId = jest.fn();

jest.mock('discord.js', () => ({
    ChannelType: {
        GuildAnnouncement: 5,
        GuildText: 0,
    },
    PermissionFlagsBits: {
        ManageGuild: BigInt(0),
    },
    SlashCommandBuilder: class SlashCommandBuilder {
        setName() { return this; }
        setDescription() { return this; }
        setDMPermission() { return this; }
        setDefaultMemberPermissions() { return this; }
        addSubcommand(fn) {
            fn({
                setName() { return this; },
                setDescription() { return this; },
                addChannelOption(optionFn) {
                    optionFn({
                        setName() { return this; },
                        setDescription() { return this; },
                        setRequired() { return this; },
                        addChannelTypes() { return this; },
                    });
                    return this;
                },
            });
            return this;
        }
    },
}));

jest.mock('../store/guilds.js', () => ({
    clearBotAnnouncementChannelId: mockClearBotAnnouncementChannelId,
    getBotAnnouncementChannelId: mockGetBotAnnouncementChannelId,
    setBotAnnouncementChannelId: mockSetBotAnnouncementChannelId,
}));

const command = require('../commands/utility/bot-announcements.js');

function createInteraction({ subcommand, channel, guildId = 'guild-1' }) {
    return {
        guildId,
        options: {
            getSubcommand: jest.fn().mockReturnValue(subcommand),
            getChannel: jest.fn().mockReturnValue(channel),
        },
        reply: jest.fn(),
    };
}

describe('/bot-announcements command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('set stores the selected channel for the current guild', async () => {
        const channel = {
            id: 'channel-1',
            guildId: 'guild-1',
            toString: () => '<#channel-1>',
        };
        const interaction = createInteraction({
            subcommand: 'set',
            channel,
        });

        await command.execute(interaction);

        expect(mockSetBotAnnouncementChannelId).toHaveBeenCalledWith('guild-1', 'channel-1');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Bot announcements will now be posted in <#channel-1>.',
            ephemeral: true,
        });
    });

    test('set rejects a channel from another guild', async () => {
        const interaction = createInteraction({
            subcommand: 'set',
            channel: {
                id: 'channel-1',
                guildId: 'guild-2',
            },
        });

        await command.execute(interaction);

        expect(mockSetBotAnnouncementChannelId).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'That channel must belong to this server.',
            ephemeral: true,
        });
    });

    test('status reports when announcements are disabled', async () => {
        mockGetBotAnnouncementChannelId.mockResolvedValue(null);
        const interaction = createInteraction({ subcommand: 'status' });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Bot announcements are currently disabled for this server.',
            ephemeral: true,
        });
    });

    test('clear disables announcements for the guild', async () => {
        const interaction = createInteraction({ subcommand: 'clear' });

        await command.execute(interaction);

        expect(mockClearBotAnnouncementChannelId).toHaveBeenCalledWith('guild-1');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Bot announcements are now disabled for this server.',
            ephemeral: true,
        });
    });
});
