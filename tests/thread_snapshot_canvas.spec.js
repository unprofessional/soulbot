const {
    DESKTOP_MAX_WIDTH,
    TEXT_FONT_FAMILY,
} = require('../features/twitter-post/canvas/constants');
const LEGACY_THREAD_FONT_FAMILY = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

jest.mock('../features/twitter-core/translation_service.js', () => ({
    buildDisplayText: jest.fn(post => post._displayText || post.text || ''),
}));

const contexts = [];
const fontAssignments = [];
const canvasCreations = [];

jest.mock('canvas', () => ({
    createCanvas: jest.fn((width, height) => {
        canvasCreations.push({ width, height });
        let currentFont = '';
        const ctx = {
            fillStyle: '#000',
            strokeStyle: '#000',
            textDrawingMode: 'glyph',
            lineWidth: 1,
            fillRect: jest.fn(),
            fillText: jest.fn(),
            fill: jest.fn(),
            drawImage: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            stroke: jest.fn(),
            arc: jest.fn(),
            clip: jest.fn(),
            save: jest.fn(),
            restore: jest.fn(),
            quadraticCurveTo: jest.fn(),
            bezierCurveTo: jest.fn(),
            closePath: jest.fn(),
            measureText: jest.fn(text => ({ width: String(text || '').length * 10 })),
        };

        Object.defineProperty(ctx, 'font', {
            get: () => currentFont,
            set: value => {
                currentFont = value;
                fontAssignments.push(value);
            },
        });

        contexts.push(ctx);

        return {
            width,
            height,
            getContext: jest.fn(() => ctx),
            toBuffer: jest.fn(() => Buffer.from('png')),
        };
    }),
    loadImage: jest.fn(async url => {
        if (String(url).includes('media')) {
            return { width: 400, height: 200 };
        }
        return { width: 100, height: 100 };
    }),
}));

const { renderThreadSnapshotCanvas } = require('../features/twitter-core/thread_snapshot_canvas');

describe('thread snapshot canvas fonts', () => {
    beforeEach(() => {
        contexts.length = 0;
        fontAssignments.length = 0;
        canvasCreations.length = 0;
    });

    test('uses the shared desktop width and font metrics instead of the legacy thread styling', async () => {
        await renderThreadSnapshotCanvas({
            isTruncated: true,
            posts: [{
                user_name: 'Example User',
                user_screen_name: 'example',
                user_profile_image_url: 'https://example.com/avatar.png',
                text: 'Thread snapshot text with emoji 😀',
                date_epoch: 1710000000,
                conversationID: '123',
            }],
        });

        expect(canvasCreations.at(-1)?.width).toBe(DESKTOP_MAX_WIDTH);
        expect(fontAssignments).toContain(`36px ${TEXT_FONT_FAMILY}`);
        expect(fontAssignments.some(font => font.includes(TEXT_FONT_FAMILY))).toBe(true);
        expect(fontAssignments.some(font => font.includes(LEGACY_THREAD_FONT_FAMILY))).toBe(false);

        const finalCtx = contexts.at(-1);
        const bodyTextCall = finalCtx.fillText.mock.calls.find(([text, x]) =>
            text.includes('Thread snapshot text') && x === 32
        );
        expect(bodyTextCall).toBeDefined();
    });

    test('renders landscape media across the final post width', async () => {
        await renderThreadSnapshotCanvas({
            isTruncated: false,
            posts: [{
                user_name: 'Example User',
                user_screen_name: 'example',
                user_profile_image_url: 'https://example.com/avatar.png',
                _mediaThumbnailUrl: 'https://example.com/media-thumb.jpg',
                text: 'Thread snapshot text with media',
                date_epoch: 1710000000,
                conversationID: '123',
            }],
        });

        const finalCtx = contexts.at(-1);
        const cropDrawCall = finalCtx.drawImage.mock.calls.find(call =>
            call.length === 9 && call[5] === 32 && call[7] === 1176 && call[8] === 588
        );

        expect(cropDrawCall).toBeDefined();
    });

    test('keeps long final posts readable without the old 16-line cutoff', async () => {
        const posts = [{
            user_name: 'Example User',
            user_screen_name: 'example',
            user_profile_image_url: 'https://example.com/avatar.png',
            text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu '.repeat(40),
            date_epoch: 1710000000,
            conversationID: '123',
        }];

        await renderThreadSnapshotCanvas({
            isTruncated: false,
            posts,
        });

        expect(contexts.at(-1).fillText.mock.calls.filter(([text]) => text.includes('alpha')).length).toBeGreaterThan(16);
        expect(canvasCreations.at(-1)?.height).toBeGreaterThan(600);
    });

    test('uses translated display text when present', async () => {
        await renderThreadSnapshotCanvas({
            isTruncated: false,
            posts: [{
                user_name: 'Example User',
                user_screen_name: 'example',
                user_profile_image_url: 'https://example.com/avatar.png',
                text: 'ola',
                _displayText: 'ola\n\n[Translated from Portuguese]\nhello',
                date_epoch: 1710000000,
                conversationID: '123',
            }],
        });

        const finalCtx = contexts.at(-1);
        const markerCall = finalCtx.fillText.mock.calls.find(([text]) =>
            String(text).includes('[Translated from Portuguese]')
        );
        expect(markerCall).toBeDefined();
    });

    test.each([
        ['2026-01-16T02:05:00Z', '9:05 PM Eastern · Jan 15, 2026'],
        ['2026-07-16T02:05:00Z', '10:05 PM Eastern · Jul 15, 2026'],
    ])('renders Eastern footer time and date for %s', async (timestamp, expected) => {
        const dateEpoch = Date.parse(timestamp) / 1000;
        await renderThreadSnapshotCanvas({
            isTruncated: false,
            posts: [dateEpoch - 120, dateEpoch].map(date_epoch => ({
                user_name: 'Example User',
                user_screen_name: 'example',
                text: 'Thread post',
                date_epoch,
            })),
        });

        expect(contexts.at(-1).fillText).toHaveBeenCalledWith(
            expected, 32, expect.any(Number)
        );
    });
    test('indents parent media, expands final media, and renders a quote card', async () => {
        const post = { user_name: 'Example', user_screen_name: 'example', date_epoch: 1710000000, text: '' };
        await renderThreadSnapshotCanvas({ posts: [
            { ...post, media_extended: [{ type: 'image', url: 'media-parent' }],
                qtMetadata: { ...post, text: 'Quoted context', media_extended: [{ type: 'image', url: 'media-quote' }] } },
            { ...post, media_extended: [{ type: 'image', url: 'media-final' }] },
        ] });
        const ctx = contexts.at(-1);
        const images = ctx.drawImage.mock.calls.filter(call => call.length === 9);
        expect(images.some(call => call[5] === 132 && call[7] === 1076)).toBe(true);
        expect(images.some(call => call[5] === 32 && call[7] === 1176)).toBe(true);
        expect(images.some(call => call[7] === 200 && call[8] === 200)).toBe(true);
        expect(ctx.fillText.mock.calls.some(([text]) => text === 'Quoted context')).toBe(true);
    });

    test.each([2, 3, 4])('renders all %i gallery tiles within the final post', async count => {
        await renderThreadSnapshotCanvas({ posts: [{
            user_name: 'Example', user_screen_name: 'example', date_epoch: 1710000000,
            media_extended: Array.from({ length: count }, (_, i) => ({ type: 'image', url: `media-${i}` })),
        }] });
        const images = contexts.at(-1).drawImage.mock.calls.filter(call => call.length === 9);
        expect(images).toHaveLength(count);
        for (const call of images) {
            expect(call[5]).toBeGreaterThanOrEqual(32);
            expect(call[5] + call[7]).toBeLessThanOrEqual(DESKTOP_MAX_WIDTH - 32);
        }
    });

    test('failed media does not leave an empty media slot', async () => {
        const { loadImage } = require('canvas');
        loadImage.mockRejectedValueOnce(new Error('unavailable'));
        const post = { user_name: 'Example', user_screen_name: 'example', date_epoch: 1710000000, text: 'Hello' };
        await renderThreadSnapshotCanvas({ posts: [{ ...post, media_extended: [{ type: 'image', url: 'missing' }] }] });
        const failedHeight = canvasCreations.at(-1).height;
        await renderThreadSnapshotCanvas({ posts: [post] });
        expect(canvasCreations.at(-1).height).toBe(failedHeight);
    });

});

test('omits engagement metrics and relative ages from parents, quotes, and final posts', async () => {
    const post = { user_name: 'Example', user_screen_name: 'example', text: 'Hello', date_epoch: 1710000000,
        replies: 12345, likes: 23456, retweets: 34567, views: 45678 };
    await renderThreadSnapshotCanvas({ posts: [{ ...post, qtMetadata: post }, post] });
    const strings = contexts.at(-1).fillText.mock.calls.map(([text]) => text);
    expect(strings.filter(text => text.startsWith('@'))).toEqual(['@example', '@example', '@example']);
    expect(strings.some(text => /Views|12.3K|23.5K|34.6K|45.7K/.test(text))).toBe(false);
    expect(strings.filter(text => text.includes('Eastern'))).toHaveLength(1);
});
