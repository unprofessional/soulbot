const { buildQuoteTweetEmbed } = require('../features/twitter-core/webhook_utils.js');

describe('animated Twitter/X quote embeds', () => {
    test('builds a linked quoted-post embed with author, text, and media preview', () => {
        const embed = buildQuoteTweetEmbed({
            tweetID: '456',
            tweetURL: 'https://twitter.com/quoted/status/456',
            user_name: 'Quoted User',
            user_screen_name: 'quoted',
            user_profile_image_url: 'https://pbs.twimg.com/profile_images/quoted.jpg',
            text: 'This is the quoted post.',
            media_extended: [{
                type: 'video',
                url: 'https://video.twimg.com/quoted.mp4',
                thumbnail_url: 'https://pbs.twimg.com/quoted.jpg',
            }],
        }, 'https://x.com/quoted/status/456');

        expect(embed).toEqual({
            color: 0x1d9bf0,
            author: {
                name: 'Quoted User (@quoted)',
                icon_url: 'https://pbs.twimg.com/profile_images/quoted.jpg',
            },
            description: 'This is the quoted post.',
            url: 'https://x.com/quoted/status/456',
            image: { url: 'https://pbs.twimg.com/quoted.jpg' },
            footer: { text: 'Quoted post on X' },
        });
    });

    test('omits the embed when no quoted post exists', () => {
        expect(buildQuoteTweetEmbed(null, null)).toBeUndefined();
    });
});
