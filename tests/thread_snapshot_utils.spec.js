jest.mock('../features/twitter-core/http.js', () => ({
    getJsonWithFallback: jest.fn(),
}));

const { getJsonWithFallback } = require('../features/twitter-core/http.js');
const { fetchTweetById } = require('../features/twitter-core/thread_snapshot_utils.js');
const { loadJsonFixture } = require('./helpers/twitter_fixtures.js');

describe('thread_snapshot_utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('fetchTweetById normalizes a local VX-style fixture', async () => {
        const fixture = loadJsonFixture('2040243625179668887.json');
        getJsonWithFallback.mockResolvedValue({
            ok: true,
            status: 200,
            json: fixture,
            url: `https://api.vxtwitter.com/status/${fixture.tweetID}`,
            ct: 'application/json',
        });

        const tweet = await fetchTweetById(fixture.tweetID, jest.fn());

        expect(getJsonWithFallback).toHaveBeenCalledWith([
            `https://api.fxtwitter.com/status/${fixture.tweetID}`,
            `https://api.vxtwitter.com/status/${fixture.tweetID}`,
            `https://api.vxtwitter.com/Twitter/status/${fixture.tweetID}`,
        ], { log: expect.any(Function) });
        expect(tweet).toEqual(expect.objectContaining({
            tweetID: fixture.tweetID,
            text: fixture.text,
            user_screen_name: fixture.user_screen_name,
        }));
    });

    test('fetchTweetById returns null for PRIVATE_TWEET FX responses', async () => {
        const log = jest.fn();
        getJsonWithFallback.mockResolvedValue({
            ok: false,
            status: 401,
            json: {
                code: 401,
                message: 'PRIVATE_TWEET',
            },
            url: 'https://api.fxtwitter.com/status/1',
            ct: 'application/json',
        });

        const tweet = await fetchTweetById('1', log);

        expect(tweet).toBeNull();
        expect(log).toHaveBeenCalledWith('🔒 Tweet is private.');
    });

    test('fetchTweetById returns null for unexpected non-JSON responses', async () => {
        const log = jest.fn();
        getJsonWithFallback.mockResolvedValue({
            ok: false,
            status: 502,
            text: '<html>bad gateway</html>',
            url: 'https://api.fxtwitter.com/status/1',
            ct: 'text/html',
        });

        const tweet = await fetchTweetById('1', log);

        expect(tweet).toBeNull();
        expect(log).toHaveBeenCalledWith(expect.stringContaining('fetchTweetById failed'));
    });
});
