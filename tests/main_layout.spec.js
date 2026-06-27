jest.mock('../features/twitter-post/image_gallery_rendering.js', () => ({
    measureGalleryHeight: jest.fn(() => 320),
}));

const {
    measureMainLayout,
    getMainRenderMode,
} = require('../features/twitter-post/canvas/main_layout.js');

describe('measureMainLayout no-description spacing', () => {
    test('does not reserve a phantom text line before image media when description is empty', () => {
        const ctx = {
            font: '',
            measureText: jest.fn(text => ({ width: String(text || '').length * 10 })),
        };

        const result = measureMainLayout(ctx, {
            metadata: { description: '' },
            images: [{ type: 'image', url: 'https://example.com/image.jpg' }],
            hasImgs: true,
            hasVids: false,
            maxWidth: 600,
            mediaMaxHeight: 600,
        });

        expect(result.descLines).toEqual([]);
        expect(result.baseY).toBe(110);
        expect(result.textHeight).toBe(0);
        expect(result.mediaY).toBe(118);
    });

    test('keeps one text line before image media when description is present', () => {
        const ctx = {
            font: '',
            measureText: jest.fn(text => ({ width: String(text || '').length * 10 })),
        };

        const result = measureMainLayout(ctx, {
            metadata: { description: 'hello' },
            images: [{ type: 'image', url: 'https://example.com/image.jpg' }],
            hasImgs: true,
            hasVids: false,
            maxWidth: 600,
            mediaMaxHeight: 600,
        });

        expect(result.descLines).toEqual(['hello']);
        expect(result.textHeight).toBe(30);
        expect(result.mediaY).toBe(148);
    });

    test('reserves poll space between post text and footer', () => {
        const ctx = {
            font: '',
            measureText: jest.fn(text => ({ width: String(text || '').length * 9 })),
        };

        const withoutPoll = measureMainLayout(ctx, {
            metadata: { description: 'Choose wisely:' },
            images: [],
            hasImgs: false,
            hasVids: false,
            maxWidth: 600,
            mediaMaxHeight: 600,
        });

        const withPoll = measureMainLayout(ctx, {
            metadata: {
                description: 'Choose wisely:',
                pollData: {
                    options: [
                        { name: 'First choice', percent: 59.56, votes: 511 },
                        { name: 'Second choice', percent: 28.09, votes: 241 },
                        { name: 'Third choice', percent: 12.35, votes: 106 },
                    ],
                },
            },
            images: [],
            hasImgs: false,
            hasVids: false,
            maxWidth: 600,
            mediaMaxHeight: 600,
        });

        expect(withPoll.hasPoll).toBe(true);
        expect(withPoll.pollHeight).toBeGreaterThan(0);
        expect(withPoll.pollY).toBeGreaterThan(withoutPoll.descBottomY);
        expect(withPoll.footerBaselineY).toBeGreaterThan(withoutPoll.footerBaselineY);
        expect(withPoll.bodyBottomY).toBeGreaterThan(withoutPoll.bodyBottomY);
    });
});

describe('getMainRenderMode', () => {
    test('switches to desktop mode for long pure-text posts without media or QT', () => {
        const mode = getMainRenderMode({
            metadata: { description: 'word '.repeat(260) },
            hasImgs: false,
            hasVids: false,
            qtMetadata: null,
        });

        expect(mode).toBe('desktop');
    });

    test('keeps article renders compact when they have preview media', () => {
        const mode = getMainRenderMode({
            metadata: {
                description: 'Article headline\n\nShort preview.',
                isArticleRender: true,
            },
            hasImgs: true,
            hasVids: false,
            qtMetadata: null,
        });

        expect(mode).toBe('compact');
    });

    test('stays compact when a long post includes a quote tweet', () => {
        const mode = getMainRenderMode({
            metadata: { description: 'word '.repeat(260) },
            hasImgs: false,
            hasVids: false,
            qtMetadata: { description: 'quoted' },
        });

        expect(mode).toBe('compact');
    });
});

describe('measureMainLayout desktop mode', () => {
    test('uses wider wrapping, desktop line height, and the higher text cap', () => {
        const ctx = {
            font: '',
            measureText: jest.fn(text => ({ width: String(text || '').length * 10 })),
        };
        const longText = 'alpha beta gamma delta epsilon '.repeat(120);

        const result = measureMainLayout(ctx, {
            metadata: { description: longText },
            images: [],
            hasImgs: false,
            hasVids: false,
            maxWidth: 1240,
            layoutMode: 'desktop',
            mediaMaxHeight: 600,
            maxDescChars: 2500,
        });

        expect(result.layoutMode).toBe('desktop');
        expect(result.mainWrapWidth).toBe(1170);
        expect(result.lineHeight).toBe(32);
        expect(result.textHeight).toBe(result.descLines.length * 32);
        expect(result.descLines.join('\n').length).toBeGreaterThan(1000);
        expect(result.descLines.join('\n').length).toBeLessThanOrEqual(2500);
    });
});
