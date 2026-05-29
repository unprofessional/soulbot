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

jest.mock('../store/services/messages.service.js', () => ({
    findMessagesByLink: jest.fn(),
}));

const {
    fetchMetadata,
    fetchQTMetadata,
} = require('../features/twitter-core/fetch_metadata.js');
const { renderTwitterPost } = require('../features/twitter-core/render_twitter_post.js');
const { enrichMetadataWithTranslation } = require('../features/twitter-core/translation_service.js');
const { findMessagesByLink } = require('../store/services/messages.service.js');
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

    beforeEach(() => {
        jest.clearAllMocks();
        findMessagesByLink.mockResolvedValue([]);
        enrichMetadataWithTranslation.mockResolvedValue(undefined);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
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
});
