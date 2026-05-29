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
            'https://api.vxtwitter.com/unpromadman/status/1486771164475232260',
            'https://api.fxtwitter.com/unpromadman/status/1486771164475232260',
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
});
