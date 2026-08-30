const { collectMedia } = require('../features/twitter-core/utils.js');

describe('collectMedia', () => {
    test('preserves VX animated GIF media as a distinct GIF type', () => {
        const media = collectMedia({
            mediaURLs: ['https://video.twimg.com/tweet_video/HQ7MHzNWEAAXCC4.mp4'],
            media_extended: [{
                type: 'gif',
                url: 'https://video.twimg.com/tweet_video/HQ7MHzNWEAAXCC4.mp4',
                thumbnail_url: 'https://pbs.twimg.com/tweet_video_thumb/HQ7MHzNWEAAXCC4.jpg',
                size: { width: 448, height: 252 },
            }],
        });

        expect(media).toEqual([expect.objectContaining({
            type: 'gif',
            url: 'https://video.twimg.com/tweet_video/HQ7MHzNWEAAXCC4.mp4',
            size: { width: 448, height: 252 },
        })]);
    });
});
