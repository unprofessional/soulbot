// features/twitter-core/thread_snapshot_canvas.js

const { createCanvas, loadImage, registerFont } = require('canvas');
const { threadBubbleWrapText } = require('./canvas_utils');

// Paths to various fonts for multilingual + emoji support
const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK'],
];

// Layout constants
const MAX_WIDTH = 1080;
const PADDING_X = 40;
const PADDING_Y = 60;
const AVATAR_SIZE = 48;
const MIN_BUBBLE_WIDTH = 300;
const LINE_HEIGHT = 28;
const FONT_SIZE = 20;
const FONT_FAMILY = '"Noto Color Emoji", "Noto Sans CJK", "Noto Sans Math"';
const INNER_BUBBLE_PADDING = 24;
const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 96;
const THUMB_MARGIN_RIGHT = 12;

function registerFonts(baseFontUrl = '/usr/share/fonts') {
    FONT_PATHS.forEach(([path, family]) =>
        registerFont(`${baseFontUrl}${path}`, { family })
    );
}

function formatTimePassed(msDelta) {
    const seconds = Math.floor(msDelta / 1000);
    if (seconds < 60) return `${seconds} seconds later`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} later`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} later`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} later`;
}

function formatAbsoluteTimestamp(ms, replyToMs = null) {
    const date = new Date(ms);
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    let result = `${timeStr} · ${dateStr}`;
    if (replyToMs && replyToMs < ms) {
        const deltaMs = ms - replyToMs;
        result += ` · ${formatTimePassed(deltaMs)}`;
    }
    return result;
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
    ctx.font = `20px ${FONT_FAMILY}`;
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

async function renderPost(ctx, post, y, isOriginating = false) {
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

    y += AVATAR_SIZE - 20;

    const hasText = post._wrappedLines && post._wrappedLines.some(line => line.trim() !== '');
    let thumbnailDrawn = false;
    let bubbleX = nameX;

    // Media thumbnail first, to the left of the bubble
    if (post._mediaThumbnailUrl) {
        try {
            const img = await loadImage(post._mediaThumbnailUrl);
            const thumbX = nameX;
            const thumbY = y;
            ctx.drawImage(img, thumbX, thumbY, THUMB_WIDTH, THUMB_HEIGHT);
            thumbnailDrawn = true;

            if (hasText) {
                bubbleX = thumbX + THUMB_WIDTH + THUMB_MARGIN_RIGHT;
            }
        } catch (err) {
            console.warn(`Failed to load media thumbnail for ${post.user_screen_name}:`, err);
        }
    }

    const timestampY = y + (hasText ? Math.max(post._bubbleHeight, THUMB_HEIGHT) : THUMB_HEIGHT) + 20;

    if (hasText) {
        const { _wrappedLines: lines, _bubbleWidth: bw, _bubbleHeight: bh } = post;

        ctx.fillStyle = isOriginating ? '#495b8a' : '#383838';
        drawRoundedRect(ctx, bubbleX, y, bw, bh, 12);

        ctx.font = isOriginating ? `bold 20px ${FONT_FAMILY}` : `20px ${FONT_FAMILY}`;
        ctx.fillStyle = '#e4e4e4ff';
        lines.forEach((line, i) => {
            ctx.fillText(line, bubbleX + 12, y + 22 + i * (isOriginating ? 24 : LINE_HEIGHT));
        });

        ctx.font = `12px ${FONT_FAMILY}`;
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(
            formatAbsoluteTimestamp(date_epoch * 1000, post.reply_to_epoch ? post.reply_to_epoch * 1000 : null),
            bubbleX,
            timestampY
        );

        return {
            y: timestampY + 30,
            anchor: { avatarX, avatarY, bubbleX, bubbleY: y }
        };
    } else if (thumbnailDrawn) {
        ctx.font = `12px ${FONT_FAMILY}`;
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(
            formatAbsoluteTimestamp(date_epoch * 1000, post.reply_to_epoch ? post.reply_to_epoch * 1000 : null),
            nameX,
            timestampY
        );

        return {
            y: timestampY + 30,
            anchor: { avatarX, avatarY, bubbleX: nameX, bubbleY: y }
        };
    } else {
        return {
            y: y + 30,
            anchor: { avatarX, avatarY, bubbleX: nameX, bubbleY: y }
        };
    }
}

async function renderThreadSnapshotCanvas({ posts, isTruncated }) {
    registerFonts();

    const tmpCanvas = createCanvas(1, 1);
    const tmpCtx = tmpCanvas.getContext('2d');

    let totalHeight = PADDING_Y;
    let maxContentWidth = 0;

    if (isTruncated) {
        tmpCtx.font = `20px ${FONT_FAMILY}`;
        const textWidth = tmpCtx.measureText('Earlier replies not shown').width;
        maxContentWidth = Math.max(maxContentWidth, textWidth + 24);
        totalHeight += 60;
    }

    for (const post of posts) {
        const isOriginating = post.conversationID != null || post.replyingToID == null;
        tmpCtx.font = isOriginating ? `bold 20px ${FONT_FAMILY}` : `${FONT_SIZE}px ${FONT_FAMILY}`;

        const maxTextWidth = MAX_WIDTH
            - PADDING_X - AVATAR_SIZE - 10 - PADDING_X
            - INNER_BUBBLE_PADDING
            - (post._mediaThumbnailUrl ? (THUMB_WIDTH + THUMB_MARGIN_RIGHT) : 0);

        const wrapped = threadBubbleWrapText(tmpCtx, post.text, maxTextWidth, 8);
        const maxLineWidth = Math.max(...wrapped.map(l => tmpCtx.measureText(l).width));
        const lineHeight = isOriginating ? 28 : LINE_HEIGHT;
        const baseHeight = wrapped.length * lineHeight + 24;

        post._wrappedLines = wrapped;
        post._bubbleWidth = Math.max(maxLineWidth + INNER_BUBBLE_PADDING, MIN_BUBBLE_WIDTH);
        post._bubbleHeight = Math.max(baseHeight, post._mediaThumbnailUrl ? THUMB_HEIGHT : 0);

        maxContentWidth = Math.max(
            maxContentWidth,
            post._bubbleWidth + (post._mediaThumbnailUrl ? (THUMB_WIDTH + THUMB_MARGIN_RIGHT) : 0)
        );

        totalHeight += AVATAR_SIZE - 20 + post._bubbleHeight + 30 + 20;
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

    let y = PADDING_Y;
    const postAnchors = [];

    if (isTruncated) {
        y = renderTruncationNotice(ctx, y, effectiveWidth);
    }

    posts.forEach((post, i) => {
        post.reply_to_epoch = i > 0 ? posts[i - 1].date_epoch : null;
    });

    for (const post of posts) {
        const isOriginating = post.conversationID != null || post.replyingToID == null;
        const result = await renderPost(ctx, post, y, isOriginating);
        y = result.y;
        postAnchors.push(result.anchor);
    }

    ctx.strokeStyle = '#2C3045';
    ctx.lineWidth = 2;

    for (let i = 1; i < postAnchors.length; i++) {
        const from = postAnchors[i];
        const to = postAnchors[i - 1];

        const x = from.avatarX + AVATAR_SIZE / 2;
        const y1 = from.avatarY + AVATAR_SIZE - 52;
        const y2 = to.avatarY + AVATAR_SIZE + 4;

        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    renderThreadSnapshotCanvas,
};
