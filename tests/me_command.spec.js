const mockSendInteractionWebhookProxy = jest.fn();

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

jest.mock('../features/twitter-core/webhook_utils.js', () => ({
    sendInteractionWebhookProxy: mockSendInteractionWebhookProxy,
}));

const command = require('../commands/utility/me.js');

function buildInteraction({ userId = '818606180095885332', text = 'hello world' } = {}) {
    return {
        user: { id: userId },
        options: {
            getString: jest.fn().mockReturnValue(text),
        },
        reply: jest.fn().mockResolvedValue(undefined),
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
    };
}

describe('/me', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSendInteractionWebhookProxy.mockResolvedValue(undefined);
    });

    test('rejects non-owner users', async () => {
        const interaction = buildInteraction({ userId: 'someone-else' });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You do not have permission to use this command.',
            ephemeral: true,
        });
        expect(mockSendInteractionWebhookProxy).not.toHaveBeenCalled();
    });

    test('proxies owner text through webhook helper', async () => {
        const interaction = buildInteraction({ text: '  hello from webhook me  ' });

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockSendInteractionWebhookProxy).toHaveBeenCalledWith(interaction, 'hello from webhook me');
        expect(interaction.editReply).toHaveBeenCalledWith({
            content: 'Posted.',
        });
    });

    test('rejects blank text', async () => {
        const interaction = buildInteraction({ text: '   ' });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Please provide some text to send.',
            ephemeral: true,
        });
        expect(interaction.deferReply).not.toHaveBeenCalled();
    });
});
