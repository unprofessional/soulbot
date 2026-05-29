const mockGetSummaryContext = jest.fn();
const mockSummarizeChat = jest.fn();

jest.mock('discord.js', () => ({
    SlashCommandBuilder: class SlashCommandBuilder {
        setName() { return this; }
        setDescription() { return this; }
    },
}));

jest.mock('../store/services/messages.service', () => ({
    getSummaryContext: mockGetSummaryContext,
}));

jest.mock('../features/ollama', () => ({
    summarizeChat: mockSummarizeChat,
}));

const command = require('../commands/utility/summary.js');

function buildInteraction() {
    return {
        channel: { id: 'channel-1' },
        user: { id: 'user-1' },
        commandName: 'summary',
        reply: jest.fn().mockResolvedValue(undefined),
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
    };
}

describe('/summary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSummaryContext.mockResolvedValue({
            mode: 'full',
            messages: [{ user_id: '111', content: 'hello' }],
            previousSummary: null,
            summaryHistory: [],
        });
    });

    test('edits the deferred reply when summary generation times out', async () => {
        const interaction = buildInteraction();
        const timeoutError = new Error('Task timeout');
        timeoutError.name = 'TimeoutError';
        mockSummarizeChat.mockRejectedValue(timeoutError);

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            'The summary model is taking too long right now. Please try again later.'
        );
    });
});
