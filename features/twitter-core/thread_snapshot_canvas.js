const { createCanvas, loadImage, registerFont } = require('canvas');
const { threadBubbleWrapText } = require('./canvas_utils');

const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK']
];

const MAX_WIDTH = 1080;
const PADDING_X = 40;
const PADDING_Y = 60;
const AVATAR_SIZE = 48;
const MIN_BUBBLE_WIDTH = 300;
const LINE_HEIGHT = 22;
const FONT_SIZE = 14;
const FONT_FAMILY = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';
const INNER_BUBBLE_PADDING = 24;

function registerFonts(baseFontUrl = '/usr/share/fonts') {
    FONT_PATHS.forEach(([path, family]) =>
        registerFont(`${baseFontUrl}${path}`, { family })
    );
}

function formatAbsoluteTimestamp(ms) {
    const date = new Date(ms);
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${timeStr} · ${dateStr}`;
}

function drawRoundedRect(ctx, x, y, width, height, radius = 10, fill = true) {
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
    if (fill) ctx.fill();
    else ctx.stroke();
}

function renderTruncationNotice(ctx, y, width) {
    const text = 'Earlier replies not shown';
    ctx.font = `16px ${FONT_FAMILY}`;
    const textWidth = ctx.measureText(text).width;
    const padding = 24;
    const bw = textWidth + padding;
    const bh = 38;
    const bx = (width - bw) / 2;

    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, bx, y, bw, bh, 12, false);

    ctx.fillStyle = '#888';
    ctx.fillText(text, bx + padding / 2, y + 25);

    return y + bh + 22;
}

async function renderPost(ctx, post, y, effectiveWidth, tmpCtx) {
    const { user_name, user_screen_name, user_profile_image_url, date_epoch } = post;

    const avatarX = PADDING_X;
    const avatarY = y;

    try {
        const avatarImg = await loadImage(user_profile_image_url);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    } catch {
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    const nameX = avatarX + AVATAR_SIZE + 10;
    const nameY = avatarY + 18;

    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(user_name, nameX, nameY);

    const nameWidth = ctx.measureText(user_name).width;
    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText(` @${user_screen_name}`, nameX + nameWidth, nameY);

    y += AVATAR_SIZE + 10;

    const bubbleX = nameX;
    const { _wrappedLines: lines, _bubbleWidth: bw, _bubbleHeight: bh } = post;

    ctx.fillStyle = '#383838';
    drawRoundedRect(ctx, bubbleX, y, bw, bh, 12);

    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillStyle = '#e4e4e4ff';
    lines.forEach((line, i) => ctx.fillText(line, bubbleX + 12, y + 22 + i * LINE_HEIGHT));

    // Draw timestamp below the bubble
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(formatAbsoluteTimestamp(date_epoch * 1000), bubbleX, y + bh + 20);

    return { y: y + bh + 30 + 20, anchor: { avatarX, avatarY, bubbleX, bubbleY: y } };
}

async function renderThreadSnapshotCanvas({ posts, centerIndex, isTruncated }) {
    registerFonts();

    const tmpCanvas = createCanvas(1, 1);
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

    let totalHeight = PADDING_Y;
    let maxContentWidth = 0;

    if (isTruncated) {
        tmpCtx.font = `16px ${FONT_FAMILY}`;
        const textWidth = tmpCtx.measureText('Earlier replies not shown').width;
        maxContentWidth = Math.max(maxContentWidth, textWidth + 24);
        totalHeight += 60;
    }

    for (const post of posts) {
        const wrapped = threadBubbleWrapText(
            tmpCtx,
            post.text,
            MAX_WIDTH - PADDING_X - AVATAR_SIZE - 10 - PADDING_X - INNER_BUBBLE_PADDING,
            4
        );
        const maxLineWidth = Math.max(...wrapped.map(l => tmpCtx.measureText(l).width));
        post._wrappedLines = wrapped;
        post._bubbleWidth = Math.max(maxLineWidth + INNER_BUBBLE_PADDING, MIN_BUBBLE_WIDTH);
        post._bubbleHeight = wrapped.length * LINE_HEIGHT + 24;

        maxContentWidth = Math.max(maxContentWidth, post._bubbleWidth);
        totalHeight += AVATAR_SIZE + 10 + post._bubbleHeight + 30 + 20;
    }

    totalHeight += PADDING_Y;

    const effectiveWidth = Math.min(
        MAX_WIDTH,
        PADDING_X + AVATAR_SIZE + 10 + maxContentWidth + PADDING_X
    );

    const canvas = createCanvas(effectiveWidth, totalHeight);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0C162E';
    ctx.fillRect(0, 0, effectiveWidth, totalHeight);
    ctx.textDrawingMode = 'glyph';
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = '#ffffff';

    let y = PADDING_Y;
    const postAnchors = [];

    if (isTruncated) {
        y = renderTruncationNotice(ctx, y, effectiveWidth);
    }

    for (const post of posts) {
        const result = await renderPost(ctx, post, y, effectiveWidth, tmpCtx);
        y = result.y;
        postAnchors.push(result.anchor);
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    renderThreadSnapshotCanvas,
};
