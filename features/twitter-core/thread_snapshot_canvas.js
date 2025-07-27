// features/twitter-core/thread_snapshot_canvas.js

const { createCanvas, loadImage, registerFont } = require('canvas');
const { threadBubbleWrapText } = require('./canvas_utils');

const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK']
];

function registerFonts(baseFontUrl = '/usr/share/fonts') {
    FONT_PATHS.forEach(([path, family]) =>
        registerFont(`${baseFontUrl}${path}`, { family })
    );
}

const WIDTH = 1080;
const HEIGHT = 1200;

const PADDING_X = 40;
const PADDING_Y = 60;
const AVATAR_SIZE = 48;
const BUBBLE_WIDTH = WIDTH - (PADDING_X + AVATAR_SIZE + 10 + 40);
const LINE_HEIGHT = 22;
const FONT_SIZE = 14;
const FONT_FAMILY = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';

/**
 * Render a canvas from thread post data.
 * @param {Object} options
 * @param {Array<Object>} options.posts
 * @param {number} options.centerIndex
 * @param {boolean} options.isTruncated
 * @returns {Promise<Buffer>}
 */
async function renderThreadSnapshotCanvas({ posts, centerIndex, isTruncated }) {
    registerFonts(); // ✅ register fonts before canvas

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textDrawingMode = 'glyph';
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';

    let y = PADDING_Y;

    // Optional header for truncation
    if (isTruncated) {
        const repliesHidden = centerIndex;
        ctx.fillStyle = '#888';
        ctx.font = `14px ${FONT_FAMILY}`;
        ctx.fillText(`${repliesHidden} earlier ${repliesHidden === 1 ? 'reply' : 'replies'} not shown`, PADDING_X, y);
        y += LINE_HEIGHT * 2;
    }

    for (const post of posts) {
        const { user_screen_name, user_profile_image_url, text, date_epoch } = post;

        // Avatar
        try {
            const avatarImg = await loadImage(user_profile_image_url);
            ctx.save();
            ctx.beginPath();
            ctx.arc(PADDING_X + AVATAR_SIZE / 2, y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, PADDING_X, y, AVATAR_SIZE, AVATAR_SIZE);
            ctx.restore();
        } catch {
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.arc(PADDING_X + AVATAR_SIZE / 2, y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Username
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 14px ${FONT_FAMILY}`;
        ctx.fillText(`@${user_screen_name}`, PADDING_X + AVATAR_SIZE + 10, y + 16);

        // Timestamp
        ctx.font = `12px ${FONT_FAMILY}`;
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`${formatAbsoluteTimestamp(date_epoch * 1000)}`, PADDING_X + AVATAR_SIZE + 10, y + 34);

        y += AVATAR_SIZE + 10;

        // Bubble
        const bubbleX = PADDING_X + AVATAR_SIZE + 10;
        const bubbleY = y;
        const bubbleHeight = LINE_HEIGHT * 4 + 12;

        ctx.fillStyle = '#e6e6e6'; // ✅ Light gray bubble
        ctx.fillRect(bubbleX, bubbleY, BUBBLE_WIDTH, bubbleHeight);

        ctx.font = `14px ${FONT_FAMILY}`;
        ctx.fillStyle = '#000000';

        const wrappedLines = threadBubbleWrapText(ctx, text, BUBBLE_WIDTH - 24, 4);
        wrappedLines.forEach((line, i) => {
            ctx.fillText(line, bubbleX + 12, bubbleY + 22 + i * LINE_HEIGHT);
        });

        y += bubbleHeight + 30;
    }

    return canvas.toBuffer('image/png');
}

/**
 * Format absolute tweet timestamp.
 * E.g. "10:15 AM · Jul 27, 2025"
 */
function formatAbsoluteTimestamp(ms) {
    const date = new Date(ms);
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    return `${timeStr} · ${dateStr}`;
}

module.exports = {
    renderThreadSnapshotCanvas,
};
