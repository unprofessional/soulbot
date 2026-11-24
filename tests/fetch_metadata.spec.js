jest.mock('../features/twitter-core/http.js', () => ({
    getJsonWithFallback: jest.fn(),
}));

const { getJsonWithFallback } = require('../features/twitter-core/http.js');
const {
    fetchMetadata,
    fetchQTMetadata,
    toFixupx,
} = require('../features/twitter-core/fetch_metadata.js');
const { loadJsonFixture } = require('./helpers/twitter_fixtures.js');

describe('fetch_metadata', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('fetchMetadata normalizes a VX-style local fixture without live API calls', async () => {
        const fixture = loadJsonFixture('1486771164475232260.json');
        getJsonWithFallback.mockResolvedValue({
            ok: true,
            status: 200,
            json: fixture,
            url: 'https://api.vxtwitter.com/unpromadman/status/1486771164475232260',
            ct: 'application/json',
        });

        const metadata = await fetchMetadata(
            fixture.tweetURL,
            null,
            false,
            jest.fn(),
        );

        expect(getJsonWithFallback).toHaveBeenCalledWith([
            'https://api.fxtwitter.com/unpromadman/status/1486771164475232260',
            'https://api.vxtwitter.com/unpromadman/status/1486771164475232260',
        ], { log: expect.any(Function) });
        expect(metadata).toEqual(expect.objectContaining({
            tweetID: fixture.tweetID,
            user_screen_name: fixture.user_screen_name,
            text: fixture.text,
            hasMedia: true,
        }));
        expect(metadata.media_extended[0]).toEqual(expect.objectContaining({
            type: 'video',
            url: fixture.media_extended[0].url,
        }));
    });

    test('fetchQTMetadata normalizes a quoted VX-style fixture payload', async () => {
        const mainFixture = loadJsonFixture('1855494589043425336.json');
        getJsonWithFallback.mockResolvedValue({
            ok: true,
            status: 200,
            json: mainFixture.qrt,
            url: 'https://api.vxtwitter.com/i/status/1855494400048066916',
            ct: 'application/json',
        });

        const metadata = await fetchQTMetadata(mainFixture.qrtURL, jest.fn());

        expect(getJsonWithFallback).toHaveBeenCalledWith([
            'https://api.fxtwitter.com/i/status/1855494400048066916',
            'https://api.vxtwitter.com/i/status/1855494400048066916',
        ], { log: expect.any(Function) });

        expect(metadata).toEqual(expect.objectContaining({
            tweetID: mainFixture.qrt.tweetID,
            text: mainFixture.qrt.text,
            user_screen_name: mainFixture.qrt.user_screen_name,
            hasMedia: false,
        }));
    });

    test('fetchMetadata summarizes upstream HTML failures and returns a FIXUPX fallback link', async () => {
        getJsonWithFallback.mockResolvedValue({
            ok: false,
            status: 503,
            text: '<html><body>failed to scan this tweet link</body></html>',
            url: 'https://api.vxtwitter.com/example/status/1',
            ct: 'text/html; charset=utf-8',
        });

        const metadata = await fetchMetadata(
            'https://x.com/example/status/1',
            null,
            true,
            jest.fn(),
        );

        expect(metadata).toEqual(expect.objectContaining({
            error: true,
            status: 503,
            fallback_link: 'https://fixupx.com/example/status/1',
        }));
        expect(metadata.message).toContain('Provider could not scan the tweet link.');
        expect(toFixupx('https://twitter.com/example/status/1')).toBe('https://fixupx.com/example/status/1');
    });

    test('fetchMetadata preserves FX private-tweet errors instead of returning null', async () => {
        getJsonWithFallback.mockResolvedValue({
            ok: false,
            status: 401,
            json: { code: 401, message: 'PRIVATE_TWEET', tweet: null },
            text: '{"code":401,"message":"PRIVATE_TWEET","tweet":null}',
            url: 'https://api.fxtwitter.com/eigenrobot/status/2092637710447952344',
            ct: 'application/json',
        });

        const metadata = await fetchMetadata(
            'https://x.com/eigenrobot/status/2092637710447952344',
            null,
            true,
            jest.fn(),
        );

        expect(metadata).toEqual(expect.objectContaining({
            error: true,
            status: 401,
            message: expect.stringContaining('PRIVATE_TWEET'),
        }));
    });
});

// Main posts and separately fetched quotes share provider ordering regardless of media.
test.each(['text', 'image', 'video', 'gif'])('prefers FX and accepts VX fallback for %s posts and quotes', async type => {
    const media = type === 'text' ? [] : [{ type, url: 'https://example.com/media' }];
    const payload = { tweetID: '123', user_name: 'Example', text: 'Hello', media_extended: media };
    for (const fetchPost of [
        () => fetchMetadata('https://x.com/example/status/123', null, true, jest.fn()),
        () => fetchQTMetadata('https://x.com/example/status/123', jest.fn()),
    ]) {
        getJsonWithFallback.mockClear();
        getJsonWithFallback.mockResolvedValue({ ok: true, json: payload, url: 'https://api.vxtwitter.com/example/status/123' });
        const post = await fetchPost();
        expect(getJsonWithFallback).toHaveBeenCalledWith([
            'https://api.fxtwitter.com/example/status/123',
            'https://api.vxtwitter.com/example/status/123',
        ], { log: expect.any(Function) });
        expect(post.tweetID).toBe('123');
        expect(post.media_extended).toEqual(media);
    }
});
