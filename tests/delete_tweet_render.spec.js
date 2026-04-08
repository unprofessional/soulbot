const mockGetMessageById = jest.fn();
const mockDeleteMessage = jest.fn();

jest.mock('discord.js', () => ({
    SlashCommandBuilder: class SlashCommandBuilder {
        setName() { return this; }
        setDescription() { return this; }
        setDMPermission() { return this; }
        addStringOption(fn) {
            fn({
                setName() { return this; },
                setDescription() { return this; },
                setRequired() { return this; },
            });
            return this;
        }
    },
}));

jest.mock('../store/services/messages.service.js', () => ({
    getMessageById: mockGetMessageById,
    deleteMessage: mockDeleteMessage,
}));

const command = require('../commands/utility/delete-tweet-render.js');

function buildInteraction({ target = '123', userId = 'user-1', guildId = 'guild-1', channelId = 'channel-1' } = {}) {
    return {
        guildId,
        channelId,
        user: { id: userId },
        client: {
            channels: {
                fetch: jest.fn(),
            },
        },
        options: {
            getString: jest.fn().mockReturnValue(target),
        },
        reply: jest.fn(),
        deferReply: jest.fn(),
        editReply: jest.fn(),
    };
}

describe('/delete-tweet-render', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDeleteMessage.mockResolvedValue(true);
    });

    test('rejects untracked messages', async () => {
        mockGetMessageById.mockResolvedValue(null);
        const interaction = buildInteraction();

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'That message is not a tracked tweet render, or it predates ownership tracking.',
            ephemeral: true,
        });
    });

    test('rejects non-owners', async () => {
        mockGetMessageById.mockResolvedValue({
            message_id: '123',
            channel_id: 'channel-1',
            meta: {
                kind: 'twitter_render',
                owningUserId: 'someone-else',
            },
        });

        const interaction = buildInteraction();
        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You can only delete tweet renders you own.',
            ephemeral: true,
        });
    });

    test('deletes owned tweet renders', async () => {
        mockGetMessageById.mockResolvedValue({
            message_id: '123',
            channel_id: 'channel-1',
            meta: {
                kind: 'twitter_render',
                owningUserId: 'user-1',
            },
        });

        const deleteFn = jest.fn().mockResolvedValue();
        const fetchMessage = jest.fn().mockResolvedValue({ delete: deleteFn });
        const fetchChannel = jest.fn().mockResolvedValue({
            isTextBased: () => true,
            messages: { fetch: fetchMessage },
        });

        const interaction = buildInteraction();
        interaction.client.channels.fetch = fetchChannel;
        interaction.deferReply.mockResolvedValue();
        interaction.editReply.mockResolvedValue();

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(fetchChannel).toHaveBeenCalledWith('channel-1');
        expect(fetchMessage).toHaveBeenCalledWith('123');
        expect(deleteFn).toHaveBeenCalled();
        expect(mockDeleteMessage).toHaveBeenCalledWith('123');
        expect(interaction.editReply).toHaveBeenCalledWith({
            content: 'Deleted your tweet render.',
        });
    });
});
