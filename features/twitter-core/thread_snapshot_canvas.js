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

const PADDING_X = 40;
const PADDING_Y = 60;
const AVATAR_SIZE = 48;
const BUBBLE_WIDTH = WIDTH - (PADDING_X + AVATAR_SIZE + 10 + 40);
const TEXT_WRAP_WIDTH = BUBBLE_WIDTH - 48;
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
    registerFonts();

    // === Stage 1: Measure height ===
    const tmpCanvas = createCanvas(1, 1);
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

    let totalHeight = PADDING_Y;

    if (isTruncated) {
        totalHeight += LINE_HEIGHT * 2;
    }

    for (const post of posts) {
        const wrappedLines = threadBubbleWrapText(tmpCtx, post.text, TEXT_WRAP_WIDTH, 4);
        const bubbleHeight = wrappedLines.length * LINE_HEIGHT + 24;

        totalHeight += AVATAR_SIZE + 10; // Avatar row
        totalHeight += bubbleHeight + 30; // Bubble + gap
    }

    // Add bottom padding
    totalHeight += PADDING_Y;

    // === Stage 2: Render with correct height ===
    const canvas = createCanvas(WIDTH, totalHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, WIDTH, totalHeight);
    ctx.textDrawingMode = 'glyph';
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';

    let y = PADDING_Y;

    if (isTruncated) {
        const repliesHidden = centerIndex;
        ctx.fillStyle = '#888';
        ctx.font = `14px ${FONT_FAMILY}`;
        ctx.fillText(`${repliesHidden} earlier ${repliesHidden === 1 ? 'reply' : 'replies'} not shown`, PADDING_X, y);
        y += LINE_HEIGHT * 2;
    }

    for (const post of posts) {
        const { user_name, user_screen_name, user_profile_image_url, text, date_epoch } = post;

        // === Avatar
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

        // === Name + @handle
        const nameX = PADDING_X + AVATAR_SIZE + 10;
        const nameY = y + 16;

        ctx.font = `bold 14px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(user_name, nameX, nameY);

        const nameWidth = ctx.measureText(user_name).width;

        ctx.font = `14px ${FONT_FAMILY}`;
        ctx.fillStyle = '#bbbbbb';
        ctx.fillText(` @${user_screen_name}`, nameX + nameWidth, nameY);

        // === Timestamp
        ctx.font = `12px ${FONT_FAMILY}`;
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(formatAbsoluteTimestamp(date_epoch * 1000), nameX, y + 34);

        y += AVATAR_SIZE + 10;

        // === Bubble
        const bubbleX = nameX;
        const wrappedLines = threadBubbleWrapText(tmpCtx, post.text, TEXT_WRAP_WIDTH, 4);
        const bubbleHeight = wrappedLines.length * LINE_HEIGHT + 24;

        ctx.fillStyle = '#e6e6e6';
        drawRoundedRect(ctx, bubbleX, y, BUBBLE_WIDTH, bubbleHeight, 12);

        ctx.font = `14px ${FONT_FAMILY}`;
        ctx.fillStyle = '#000000';
        wrappedLines.forEach((line, i) => {
            ctx.fillText(line, bubbleX + 12, y + 22 + i * LINE_HEIGHT);
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

function drawRoundedRect(ctx, x, y, width, height, radius = 10) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

module.exports = {
    renderThreadSnapshotCanvas,
};
