jest.mock('../features/twitter-core/fetch_metadata.js', () => ({
    fetchMetadata: jest.fn(),
    fetchQTMetadata: jest.fn(),
    toFixupx: jest.fn(link => String(link || '')
        .replace('https://twitter.com', 'https://fixupx.com')
        .replace('https://x.com', 'https://fixupx.com')),
}));

jest.mock('../features/twitter-core/render_twitter_post.js', () => ({
    renderTwitterPost: jest.fn(),
}));

jest.mock('../features/twitter-core/translation_service.js', () => ({
    enrichMetadataWithTranslation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../features/twitter-core/webhook_utils.js', () => ({
    sendWebhookProxyMsg: jest.fn(),
}));

jest.mock('../store/services/messages.service.js', () => ({
    deleteMessage: jest.fn(),
    findLatestTweetRenderByOriginalLinkAcrossGuilds: jest.fn(),
    findMessagesByLink: jest.fn(),
}));

const {
    fetchMetadata,
    fetchQTMetadata,
} = require('../features/twitter-core/fetch_metadata.js');
const { renderTwitterPost } = require('../features/twitter-core/render_twitter_post.js');
const { enrichMetadataWithTranslation } = require('../features/twitter-core/translation_service.js');
const { sendWebhookProxyMsg } = require('../features/twitter-core/webhook_utils.js');
const {
    deleteMessage,
    findLatestTweetRenderByOriginalLinkAcrossGuilds,
    findMessagesByLink,
} = require('../store/services/messages.service.js');
const { handleTwitterUrl } = require('../features/twitter-core/twitter_handler.js');
const { loadJsonFixture } = require('./helpers/twitter_fixtures.js');

function buildMessage(content) {
    return {
        id: 'message-1',
        content,
        channel: { id: 'channel-1' },
        client: {
            channels: {
                fetch: jest.fn(),
            },
        },
        suppressEmbeds: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
    };
}

describe('twitter_handler deterministic fixture flows', () => {
    let logSpy;
    let debugSpy;
    let warnSpy;
    let errorSpy;
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        jest.clearAllMocks();
        findMessagesByLink.mockResolvedValue([]);
        findLatestTweetRenderByOriginalLinkAcrossGuilds.mockResolvedValue(null);
        enrichMetadataWithTranslation.mockResolvedValue(undefined);
        sendWebhookProxyMsg.mockResolvedValue(undefined);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        global.fetch = originalFetch;
        logSpy.mockRestore();
        debugSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('renders a local-fixture text post after metadata fetch succeeds', async () => {
        const fixture = loadJsonFixture('2040243625179668887.json');
        const message = buildMessage(fixture.tweetURL);
        fetchMetadata.mockResolvedValue({ ...fixture });

        await handleTwitterUrl(message, { guildId: 'guild-1' });

        expect(fetchMetadata).toHaveBeenCalledWith(
            fixture.tweetURL,
            message,
            false,
            expect.any(Function),
        );
        expect(enrichMetadataWithTranslation).toHaveBeenCalledWith(
            expect.objectContaining({ tweetID: fixture.tweetID }),
            expect.any(Function),
        );
        expect(renderTwitterPost).toHaveBeenCalledWith(
            expect.objectContaining({ tweetID: fixture.tweetID }),
            message,
            fixture.tweetURL,
        );
        expect(message.reply).not.toHaveBeenCalled();
    });

    test('reuses the latest cross-guild tracked render attachment before metadata fetch', async () => {
        const fixture = loadJsonFixture('2040243625179668887.json');
        const message = buildMessage(fixture.tweetURL);
        const cachedBytes = Buffer.from('cached image bytes');
        const arrayBuffer = cachedBytes.buffer.slice(
            cachedBytes.byteOffset,
            cachedBytes.byteOffset + cachedBytes.byteLength
        );
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
        });
        findLatestTweetRenderByOriginalLinkAcrossGuilds.mockResolvedValue({
            message_id: 'cached-render-1',
            guild_id: 'other-guild',
            channel_id: 'other-channel',
            attachments: ['https://cdn.discordapp.com/attachments/rendered.png?ex=1'],
            meta: {
                kind: 'twitter_render',
                originalLink: fixture.tweetURL,
            },
        });

        await handleTwitterUrl(message, { guildId: 'guild-1' });

        expect(findLatestTweetRenderByOriginalLinkAcrossGuilds).toHaveBeenCalledWith(fixture.tweetURL);
        expect(global.fetch).toHaveBeenCalledWith('https://cdn.discordapp.com/attachments/rendered.png?ex=1');
        expect(sendWebhookProxyMsg).toHaveBeenCalledWith(
            message,
            'Here’s the Twitter canvas:',
            [{
                attachment: cachedBytes,
                name: 'rendered.png',
            }],
            undefined,
            fixture.tweetURL,
        );
        expect(fetchMetadata).not.toHaveBeenCalled();
        expect(renderTwitterPost).not.toHaveBeenCalled();
    });

    test('falls back to fresh render when cross-guild cached attachment download fails', async () => {
        const fixture = loadJsonFixture('2040243625179668887.json');
        const message = buildMessage(fixture.tweetURL);
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        });
        findLatestTweetRenderByOriginalLinkAcrossGuilds.mockResolvedValue({
            message_id: 'cached-render-1',
            guild_id: 'other-guild',
            channel_id: 'other-channel',
            attachments: ['https://cdn.discordapp.com/attachments/missing.png'],
            meta: {
                kind: 'twitter_render',
                originalLink: fixture.tweetURL,
            },
        });
        fetchMetadata.mockResolvedValue({ ...fixture });

        await handleTwitterUrl(message, { guildId: 'guild-1' });

        expect(sendWebhookProxyMsg).not.toHaveBeenCalled();
        expect(fetchMetadata).toHaveBeenCalledWith(
            fixture.tweetURL,
            message,
            false,
            expect.any(Function),
        );
        expect(renderTwitterPost).toHaveBeenCalledWith(
            expect.objectContaining({ tweetID: fixture.tweetID }),
            message,
            fixture.tweetURL,
        );
    });

    test('falls back to embedded quote-tweet metadata when QT fetch fails', async () => {
        const fixture = loadJsonFixture('1855494589043425336.json');
        const message = buildMessage(fixture.tweetURL);
        fetchMetadata.mockResolvedValue({
            ...fixture,
            qtMetadata: fixture.qrt,
        });
        fetchQTMetadata.mockResolvedValue({
            error: true,
            message: 'Provider could not scan the tweet link. Defaulting to a FIXUPX link.',
            fallback_link: 'https://fixupx.com/i/status/1855494400048066916',
        });

        await handleTwitterUrl(message, { guildId: 'guild-1' });

        expect(fetchQTMetadata).toHaveBeenCalledWith(
            fixture.qrtURL,
            expect.any(Function),
        );
        expect(renderTwitterPost).toHaveBeenCalledWith(
            expect.objectContaining({
                tweetID: fixture.tweetID,
                qtMetadata: expect.objectContaining({
                    tweetID: fixture.qrt.tweetID,
                    text: fixture.qrt.text,
                }),
            }),
            message,
            fixture.tweetURL,
        );
        expect(message.reply).not.toHaveBeenCalled();
    });

    test('replies with FIXUPX fallback when upstream metadata fetch returns an error', async () => {
        const message = buildMessage('https://x.com/example/status/1');
        fetchMetadata.mockResolvedValue({
            error: true,
            message: 'Provider could not scan the tweet link. Defaulting to a FIXUPX link.',
            fallback_link: 'https://fixupx.com/example/status/1',
        });

        await handleTwitterUrl(message, { guildId: 'guild-1' });

        expect(renderTwitterPost).not.toHaveBeenCalled();
        expect(message.reply).toHaveBeenCalledWith(
            'Provider could not scan the tweet link. Defaulting to a FIXUPX link.\n→ https://fixupx.com/example/status/1'
        );
    });

    test('replies with the original Discord link when the tweet was already rendered', async () => {
        const fixture = loadJsonFixture('2040243625179668887.json');
        const message = buildMessage(fixture.tweetURL);
        const forward = jest.fn().mockResolvedValue(undefined);
        const originalMessage = { id: 'orig-msg-1', forward };
        const originalChannel = {
            id: 'channel-9',
            isTextBased: () => true,
            messages: {
                fetch: jest.fn().mockResolvedValue(originalMessage),
            },
        };
        message.client.channels.fetch.mockResolvedValue(originalChannel);
        findMessagesByLink.mockResolvedValue([{
            message_id: 'orig-msg-1',
            channel_id: 'channel-9',
            meta: {
                kind: 'twitter_render',
            },
        }]);

        await handleTwitterUrl(message, { guildId: 'guild-1' });

        expect(fetchMetadata).not.toHaveBeenCalled();
        expect(originalChannel.messages.fetch).toHaveBeenCalledWith('orig-msg-1');
        expect(forward).toHaveBeenCalledWith(message.channel);
        expect(message.reply).toHaveBeenCalledWith(
            'Someone already posted this here: https://discord.com/channels/guild-1/channel-9/orig-msg-1'
        );
    });

    test('cleans up stale duplicate records and renders when the original Discord message is gone', async () => {
        const fixture = loadJsonFixture('2040243625179668887.json');
        const message = buildMessage(fixture.tweetURL);
        const originalChannel = {
            id: 'channel-9',
            isTextBased: () => true,
            messages: {
                fetch: jest.fn().mockRejectedValue(Object.assign(new Error('Unknown Message'), { code: 10008 })),
            },
        };
        message.client.channels.fetch.mockResolvedValue(originalChannel);
        findMessagesByLink.mockResolvedValue([{
            message_id: 'stale-render-1',
            channel_id: 'channel-9',
            meta: {
                kind: 'twitter_render',
            },
        }]);
        fetchMetadata.mockResolvedValue({ ...fixture });

        await handleTwitterUrl(message, { guildId: 'guild-1' });

        expect(originalChannel.messages.fetch).toHaveBeenCalledWith('stale-render-1');
        expect(deleteMessage).toHaveBeenCalledWith('stale-render-1');
        expect(fetchMetadata).toHaveBeenCalledWith(
            fixture.tweetURL,
            message,
            false,
            expect.any(Function),
        );
        expect(renderTwitterPost).toHaveBeenCalledWith(
            expect.objectContaining({ tweetID: fixture.tweetID }),
            message,
            fixture.tweetURL,
        );
        expect(message.reply).not.toHaveBeenCalledWith(
            expect.stringContaining('Someone already posted this here:')
        );
    });
});
