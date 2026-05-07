const {
    normalizeMainMetadata,
    buildArticleDisplayText,
    isArticleLinkOnlyText,
} = require('../features/twitter-post/canvas/metadata_normalize.js');

describe('metadata_normalize article renders', () => {
    test('detects X article links as link-only tweet text', () => {
        expect(isArticleLinkOnlyText('https://x.com/i/article/2052495597194936320')).toBe(true);
        expect(isArticleLinkOnlyText('http://twitter.com/i/article/2052495597194936320')).toBe(true);
        expect(isArticleLinkOnlyText('read this https://x.com/i/article/2052495597194936320')).toBe(false);
    });

    test('buildArticleDisplayText prefers title plus full text before preview text', () => {
        expect(buildArticleDisplayText({
            title: 'Article title',
            text: 'Full article body.',
            preview_text: 'Preview snippet.',
        }, 'https://x.com/i/article/1')).toBe('Article title\n\nFull article body.');
    });

    test('normalizes article-link-only tweets as desktop text without article card media', () => {
        const { metadata, images, videos } = normalizeMainMetadata({
            tweetID: '2052502030778843379',
            text: 'https://x.com/i/article/2052495597194936320',
            user_name: 'U.S. Central Command',
            user_screen_name: 'CENTCOM',
            user_profile_image_url: 'https://example.com/pfp.jpg',
            date_epoch: 1778189592,
            media_extended: [],
            article: {
                title: 'CENTCOM Protects U.S. Warships Transiting Strait of Hormuz',
                preview_text: 'TAMPA, Fla. - U.S. forces intercepted unprovoked Iranian attacks.',
                image: 'https://pbs.twimg.com/media/HHvvZVBWgAETpx1.jpg',
            },
        });

        expect(metadata.isArticleRender).toBe(true);
        expect(metadata.description).toBe(
            'CENTCOM Protects U.S. Warships Transiting Strait of Hormuz\n\n' +
            'TAMPA, Fla. - U.S. forces intercepted unprovoked Iranian attacks.'
        );
        expect(images).toEqual([]);
        expect(videos).toEqual([]);
    });
});
