const {
    DESKTOP_MAX_WIDTH,
    MAIN_FONT,
    TEXT_FONT_FAMILY,
} = require('../features/twitter-post/canvas/constants');
const LEGACY_THREAD_FONT_FAMILY = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

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
        expect(fontAssignments).toContain(MAIN_FONT);
        expect(fontAssignments.some(font => font.includes(TEXT_FONT_FAMILY))).toBe(true);
        expect(fontAssignments.some(font => font.includes(LEGACY_THREAD_FONT_FAMILY))).toBe(false);

        const finalCtx = contexts.at(-1);
        const bodyTextCall = finalCtx.fillText.mock.calls.find(([text, x]) =>
            text.includes('Thread snapshot text') && x === 110
        );
        expect(bodyTextCall).toBeDefined();
    });

    test('center-crops media thumbnails into the larger desktop square instead of stretching them', async () => {
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
            call.length === 9 && call[5] === 98 && call[7] === 175 && call[8] === 175
        );

        expect(cropDrawCall).toBeDefined();
    });

    test('allows up to 16 wrapped lines for long thread posts and grows the canvas height', async () => {
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

        expect(posts[0]._wrappedLines).toHaveLength(16);
        expect(posts[0]._wrappedLines.at(-1).endsWith('…')).toBe(true);
        expect(canvasCreations.at(-1)?.height).toBeGreaterThan(600);
    });
});
