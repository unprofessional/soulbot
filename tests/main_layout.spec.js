jest.mock('../features/twitter-post/image_gallery_rendering.js', () => ({
    measureGalleryHeight: jest.fn(() => 320),
}));

const {
    measureMainLayout,
    getMainRenderMode,
} = require('../features/twitter-post/canvas/main_layout.js');

describe('measureMainLayout no-description spacing', () => {
    test('reserves one text line before image media when description is empty', () => {
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
        expect(result.textHeight).toBe(30);
        expect(result.mediaY).toBe(148);
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
