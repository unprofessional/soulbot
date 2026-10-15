const { sendTwitterFallback, sendInteractionWebhookProxy } = require('../features/twitter-core/webhook_utils');
const { consumePendingRenderOwnership } = require('../features/twitter-core/render_ownership_registry');

function fixture() {
    const webhook = { id: 'proxy-test', send: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue() };
    const parent = { createWebhook: jest.fn().mockResolvedValue(webhook), fetchWebhooks: jest.fn().mockResolvedValue({ filter: () => new Map() }) };
    const channel = { id: 'thread', isThread: () => true, parent };
    const user = { id: 'user', username: 'User', displayAvatarURL: () => 'avatar' };
    const message = { id: 'source', content: 'look https://x.com/a/status/123', author: user, channel,
        client: { user: { id: 'bot' } }, suppressEmbeds: jest.fn().mockResolvedValue(), delete: jest.fn().mockResolvedValue() };
    return { webhook, channel, user, message };
}

test('fallback preserves text, permits link preview, registers deletion ownership and deletes after delivery', async () => {
    const { webhook, message } = fixture();
    await sendTwitterFallback(message, 'https://x.com/a/status/123');
    expect(message.suppressEmbeds).toHaveBeenCalledWith(true);
    expect(webhook.send).toHaveBeenCalledWith(expect.objectContaining({ content: 'look https://fixupx.com/a/status/123', threadId: 'thread' }));
    expect(consumePendingRenderOwnership(webhook.id)).toMatchObject({ kind: 'twitter_render', owningUserId: 'user', originalMessageId: 'source', originalLink: 'https://x.com/a/status/123' });
    expect(message.delete.mock.invocationCallOrder[0]).toBeGreaterThan(webhook.send.mock.invocationCallOrder[0]);
});
test('failed fallback delivery keeps the source and cleans the temporary webhook', async () => {
    const { webhook, message } = fixture();
    webhook.send.mockRejectedValue(new Error('failed'));
    await expect(sendTwitterFallback(message, 'https://x.com/a/status/123')).rejects.toThrow('failed');
    expect(message.delete).not.toHaveBeenCalled();
    expect(webhook.delete).toHaveBeenCalled();
});
test('interaction render has the invoking user as deletion owner and includes files', async () => {
    const { webhook, channel, user } = fixture();
    const files = [{ attachment: Buffer.from('png'), name: 'thread.png' }];
    await sendInteractionWebhookProxy({ channel, user }, '<https://x.com/a/status/123>', { files, originalLink: 'https://x.com/a/status/123' });
    expect(webhook.send).toHaveBeenCalledWith(expect.objectContaining({ files, threadId: 'thread', allowedMentions: { parse: [] } }));
    expect(consumePendingRenderOwnership(webhook.id)).toMatchObject({ kind: 'twitter_render', owningUserId: 'user', originalMessageId: null, originalLink: 'https://x.com/a/status/123' });
});

test('fallback unwraps a bracketed source URL with tracking parameters', async () => {
    const { webhook, message } = fixture();
    message.content = 'look <https://x.com/a/status/123?s=20> after';
    await sendTwitterFallback(message, 'https://x.com/a/status/123');
    expect(webhook.send).toHaveBeenCalledWith(expect.objectContaining({ content: 'look https://fixupx.com/a/status/123 after' }));
});
