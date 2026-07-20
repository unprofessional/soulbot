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
    const originalGeneralLlmInferenceEnabled = process.env.GENERAL_LLM_INFERENCE_ENABLED;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GENERAL_LLM_INFERENCE_ENABLED = 'true';
        mockGetSummaryContext.mockResolvedValue({
            mode: 'full',
            messages: [{ user_id: '111', content: 'hello' }],
            previousSummary: null,
            summaryHistory: [],
        });
    });

    afterEach(() => {
        if (originalGeneralLlmInferenceEnabled === undefined) {
            delete process.env.GENERAL_LLM_INFERENCE_ENABLED;
        } else {
            process.env.GENERAL_LLM_INFERENCE_ENABLED = originalGeneralLlmInferenceEnabled;
        }
    });

    test('replies without loading context when general LLM inference is disabled', async () => {
        delete process.env.GENERAL_LLM_INFERENCE_ENABLED;
        const interaction = buildInteraction();

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'General LLM features are disabled right now so the GPUs stay free. Tweet/X translation rendering is still available.',
            ephemeral: true,
        });
        expect(interaction.deferReply).not.toHaveBeenCalled();
        expect(mockGetSummaryContext).not.toHaveBeenCalled();
        expect(mockSummarizeChat).not.toHaveBeenCalled();
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
