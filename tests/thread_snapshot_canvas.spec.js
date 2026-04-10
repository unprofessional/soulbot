const {
    DESKTOP_MAX_WIDTH,
    MAIN_FONT,
    TEXT_FONT_FAMILY,
} = require('../features/twitter-post/canvas/constants');
const { MAIN_DESKTOP } = require('../features/twitter-core/layout/geometry');

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
    loadImage: jest.fn(async () => ({})),
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
            text.includes('Thread snapshot text') && x === MAIN_DESKTOP.descXWithMedia + 12
        );
        expect(bodyTextCall).toBeDefined();
    });
});
