const {
    normalizeMainMetadata,
    appendPreviewEllipsis,
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
        }, 'https://x.com/i/article/1')).toBe(
            '[X article preview]\n\nArticle title\n\nFull article body.\n\n' +
            '[Click the article link to read the full article.]'
        );
    });

    test('appendPreviewEllipsis marks unfinished article previews', () => {
        expect(appendPreviewEllipsis('Preview ends mid thought')).toBe('Preview ends mid thought...');
        expect(appendPreviewEllipsis('Preview already ended.')).toBe('Preview already ended.');
        expect(appendPreviewEllipsis('Preview already ended...')).toBe('Preview already ended...');
    });

    test('normalizes article-link-only tweets as compact text with article card media', () => {
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
            '[X article preview]\n\n' +
            'CENTCOM Protects U.S. Warships Transiting Strait of Hormuz\n\n' +
            'TAMPA, Fla. - U.S. forces intercepted unprovoked Iranian attacks.\n\n' +
            '[Click the article link to read the full article.]'
        );
        expect(images).toEqual([expect.objectContaining({
            type: 'image',
            source: 'article',
            url: 'https://pbs.twimg.com/media/HHvvZVBWgAETpx1.jpg',
        })]);
        expect(videos).toEqual([]);
    });

    test('keeps article preview media after the render prepass stores it in media_extended', () => {
        const { images } = normalizeMainMetadata({
            text: 'https://x.com/i/article/2052495597194936320',
            user_name: 'U.S. Central Command',
            user_screen_name: 'CENTCOM',
            user_profile_image_url: 'https://example.com/pfp.jpg',
            date_epoch: 1778189592,
            media_extended: [{
                type: 'image',
                source: 'article',
                url: 'https://pbs.twimg.com/media/HHvvZVBWgAETpx1.jpg',
                thumbnail_url: 'https://pbs.twimg.com/media/HHvvZVBWgAETpx1.jpg',
            }],
            article: {
                title: 'CENTCOM Protects U.S. Warships Transiting Strait of Hormuz',
                preview_text: 'TAMPA, Fla. - U.S. forces intercepted unprovoked Iranian attacks',
                image: 'https://pbs.twimg.com/media/HHvvZVBWgAETpx1.jpg',
            },
        });

        expect(images).toEqual([expect.objectContaining({
            source: 'article',
            url: 'https://pbs.twimg.com/media/HHvvZVBWgAETpx1.jpg',
        })]);
    });
});
