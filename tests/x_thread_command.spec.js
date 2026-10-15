jest.mock('../features/twitter-core/thread_snapshot_handler', () => ({ handleThreadSnapshot: jest.fn() }));
jest.mock('../features/twitter-core/webhook_utils', () => ({ sendInteractionWebhookProxy: jest.fn() }));
const { handleThreadSnapshot } = require('../features/twitter-core/thread_snapshot_handler');
const { sendInteractionWebhookProxy } = require('../features/twitter-core/webhook_utils');
const command = require('../commands/utility/x-thread');

beforeEach(() => jest.resetAllMocks());
test.each([Buffer.from('png'), 'thread fallback'])('proxies thread result and removes the interaction response', async result => {
    const interaction = {
        options: { getString: () => 'https://x.com/a/status/123' },
        deferReply: jest.fn(), deleteReply: jest.fn(), editReply: jest.fn(),
    };
    handleThreadSnapshot.mockResolvedValue(result);
    await command.execute(interaction);
    expect(sendInteractionWebhookProxy).toHaveBeenCalledWith(interaction,
        Buffer.isBuffer(result) ? '<https://x.com/a/status/123>' : result,
        { originalLink: 'https://x.com/a/status/123', files: Buffer.isBuffer(result) ? [{ attachment: result, name: 'thread.png' }] : [] });
    expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).not.toHaveBeenCalled();
});
test('retains an error response when webhook delivery fails', async () => {
    const interaction = {
        options: { getString: () => 'https://x.com/a/status/123' },
        deferReply: jest.fn(), deleteReply: jest.fn(), editReply: jest.fn(),
    };
    handleThreadSnapshot.mockResolvedValue(Buffer.from('png'));
    sendInteractionWebhookProxy.mockRejectedValue(new Error('send failed'));
    await command.execute(interaction);
    expect(interaction.deleteReply).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
});

test('long text fallback is attached instead of exceeding Discord content limits', async () => {
    const interaction = {
        options: { getString: () => 'https://x.com/a/status/123' },
        deferReply: jest.fn(), deleteReply: jest.fn(), editReply: jest.fn(),
    };
    handleThreadSnapshot.mockResolvedValue('x'.repeat(2001));
    await command.execute(interaction);
    expect(sendInteractionWebhookProxy).toHaveBeenCalledWith(interaction, '<https://x.com/a/status/123>', {
        originalLink: 'https://x.com/a/status/123', files: [{ name: 'thread.txt', attachment: Buffer.from('x'.repeat(2001)) }],
    });
    expect(interaction.deleteReply).toHaveBeenCalled();
});
