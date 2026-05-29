const mockGetMessageById = jest.fn();
const mockSummarizeSingleMessage = jest.fn();

jest.mock('discord.js', () => ({
    SlashCommandBuilder: class SlashCommandBuilder {
        setName() { return this; }
        setDescription() { return this; }
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

jest.mock('../store/services/messages.service', () => ({
    getMessageById: mockGetMessageById,
}));

jest.mock('../features/ollama', () => ({
    summarizeSingleMessage: mockSummarizeSingleMessage,
}));

const command = require('../commands/utility/summarize-message.js');

function buildInteraction({ messageId = 'msg-1', guildId = 'guild-1' } = {}) {
    return {
        guildId,
        guild: { id: guildId },
        channel: { id: 'channel-1' },
        user: { id: 'user-1' },
        commandName: 'summarize-message',
        options: {
            getString: jest.fn().mockReturnValue(messageId),
        },
        reply: jest.fn().mockResolvedValue(undefined),
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
    };
}

describe('/summarize-message', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetMessageById.mockResolvedValue({
            message_id: 'msg-1',
            guild_id: 'guild-1',
            user_id: 'author-1',
            content: 'Three weeks as a SAFugee in Utah...',
        });
        mockSummarizeSingleMessage.mockResolvedValue('A brief summary of one post.');
    });

    test('summarizes only the requested stored message and does not echo the request', async () => {
        const interaction = buildInteraction();

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(mockGetMessageById).toHaveBeenCalledWith('msg-1');
        expect(mockSummarizeSingleMessage).toHaveBeenCalledWith(expect.objectContaining({
            message_id: 'msg-1',
            content: 'Three weeks as a SAFugee in Utah...',
        }));
        expect(interaction.editReply).toHaveBeenCalledWith('**Summary:**\nA brief summary of one post.');
        expect(interaction.editReply.mock.calls[0][0]).not.toContain('**Request:**');
    });

    test('does not summarize a message from another guild', async () => {
        const interaction = buildInteraction();
        mockGetMessageById.mockResolvedValue({
            message_id: 'msg-1',
            guild_id: 'guild-2',
            user_id: 'author-1',
            content: 'private elsewhere',
        });

        await command.execute(interaction);

        expect(mockSummarizeSingleMessage).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith('I could not find that message in this server.');
    });

    test('edits the deferred reply when summary generation times out', async () => {
        const interaction = buildInteraction();
        const timeoutError = new Error('Task timeout');
        timeoutError.name = 'TimeoutError';
        mockSummarizeSingleMessage.mockRejectedValue(timeoutError);

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            'The summary model is taking too long right now. Please try again later.'
        );
    });
});
