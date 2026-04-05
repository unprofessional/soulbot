jest.mock('../features/twitter-post/image_gallery_rendering.js', () => ({
    measureGalleryHeight: jest.fn(() => 320),
}));

const { measureMainLayout } = require('../features/twitter-post/canvas/main_layout.js');

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
