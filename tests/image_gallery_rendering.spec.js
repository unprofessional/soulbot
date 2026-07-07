const { createCanvas } = require('canvas');

const {
    buildCombinedGalleryCanvas,
    containRect,
    coverRect,
    getCombinedNaturalSize,
    getTileRects,
    measureGalleryHeight,
} = require('../features/twitter-post/image_gallery_rendering.js');

function imageItem(width, height) {
    return {
        type: 'image',
        url: `https://example.com/${width}x${height}.jpg`,
        size: { width, height },
    };
}

describe('VX-style image gallery sizing', () => {
    test('uses the largest image as the canonical two-image tile size', () => {
        const items = [
            imageItem(1206, 1539),
            imageItem(896, 1152),
        ];

        expect(getCombinedNaturalSize(items)).toEqual({
            width: 2412,
            height: 1539,
        });
        expect(measureGalleryHeight({ mediaExtended: items }, 600, 560)).toBe(357);
    });

    test('uses a two-by-two natural canvas for three images', () => {
        const items = [
            imageItem(2782, 2104),
            imageItem(748, 656),
            imageItem(856, 1050),
        ];

        expect(getCombinedNaturalSize(items)).toEqual({
            width: 5564,
            height: 4208,
        });
        expect(measureGalleryHeight({ mediaExtended: items }, 600, 560)).toBe(424);
    });

    test('places the third image across the full bottom row', () => {
        expect(getTileRects(3, 1000, 800)).toEqual([
            { x: 0, y: 0, width: 500, height: 400 },
            { x: 500, y: 0, width: 500, height: 400 },
            { x: 0, y: 400, width: 1000, height: 400 },
        ]);
    });

    test('computes contain and cover draw rectangles without changing aspect ratio', () => {
        const contained = containRect(1206, 1539, 0, 0, 280, 357);
        expect(contained.y).toBe(0);
        expect(contained.height).toBe(357);
        expect(contained.width).toBeCloseTo(279.754, 3);
        expect(contained.x).toBeCloseTo(0.123, 3);

        const covered = coverRect(1206, 1539, 0, 0, 280, 357);
        expect(covered.x).toBe(0);
        expect(covered.width).toBe(280);
        expect(covered.y).toBeCloseTo(-0.157, 3);
        expect(covered.height).toBeCloseTo(357.313, 3);
    });

    test('builds a capped composite canvas at the expected aspect ratio', () => {
        const first = createCanvas(1206, 1539);
        const second = createCanvas(896, 1152);
        const items = [
            imageItem(1206, 1539),
            imageItem(896, 1152),
        ];

        const combined = buildCombinedGalleryCanvas([first, second], items);

        expect(combined.width).toBe(2412);
        expect(combined.height).toBe(1539);
    });
});
