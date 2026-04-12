// features/twitter-core/thread_snapshot_canvas.js

const { createCanvas, loadImage } = require('canvas');
const { threadBubbleWrapText } = require('./canvas_utils');
const { cropSingleImage } = require('../twitter-post/crop_single_image');
const { MAIN_DESKTOP, getMainLineHeight } = require('./layout/geometry');
const {
    DESKTOP_MAX_WIDTH,
    MAIN_FONT,
    TEXT_FONT_FAMILY,
} = require('../twitter-post/canvas/constants');
const { buildDisplayText } = require('./translation_service.js');

// Layout constants
const MAX_WIDTH = DESKTOP_MAX_WIDTH;
const PADDING_X = 40;
const PADDING_Y = 60;
const AVATAR_SIZE = 48;
const MIN_BUBBLE_WIDTH = 300;
const LINE_HEIGHT = getMainLineHeight({ layoutMode: 'desktop' });
const FONT_FAMILY = TEXT_FONT_FAMILY;
const INNER_BUBBLE_PADDING = 24;
const THUMB_WIDTH = 175;
const THUMB_HEIGHT = 175;
const THUMB_MARGIN_RIGHT = 12;
const MAX_THREAD_LINES = 16;
const BUBBLE_TEXT_INSET = INNER_BUBBLE_PADDING / 2;
const THREAD_RIGHT_PAD = MAIN_DESKTOP.rightPad;

const BACKGROUND_COLOR = '#000';
const PRIMARY_TEXT_COLOR = '#fff';
const SECONDARY_TEXT_COLOR = 'gray';
const MUTED_TEXT_COLOR = '#888';
const TIMESTAMP_TEXT_COLOR = '#aaa';
const BUBBLE_FILL_COLOR = '#383838';
const DIVIDER_COLOR = '#444';
const BODY_FONT = MAIN_FONT;

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
    ctx.font = BODY_FONT;
    const textWidth = ctx.measureText(text).width;
    const padding = 24;
    const bw = textWidth + padding;
    const bh = 38;
    const bx = (width - bw) / 2;

    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.strokeStyle = DIVIDER_COLOR;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, bx, y, bw, bh, 12, false);

    ctx.fillStyle = MUTED_TEXT_COLOR;
    ctx.fillText(text, bx + padding / 2, y + 25);

    return y + bh + 22;
}

async function renderPost(ctx, post, y) {
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
        ctx.fillStyle = DIVIDER_COLOR;
        ctx.beginPath();
        ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    const nameX = avatarX + AVATAR_SIZE + 10;
    const nameY = avatarY + 18;
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.fillStyle = PRIMARY_TEXT_COLOR;
    ctx.fillText(user_name, nameX, nameY);

    const nameWidth = ctx.measureText(user_name).width;
    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.fillStyle = SECONDARY_TEXT_COLOR;
    ctx.fillText(` @${user_screen_name}`, nameX + nameWidth, nameY);

    y += AVATAR_SIZE - 20;

    const hasText = post._wrappedLines && post._wrappedLines.some(line => line.trim() !== '');
    let thumbnailDrawn = false;
    const contentX = nameX;
    let bubbleX = contentX;

    // Media thumbnail first, to the left of the bubble
    if (post._mediaThumbnailUrl) {
        try {
            const img = await loadImage(post._mediaThumbnailUrl);
            const thumbX = contentX;
            const thumbY = y;
            cropSingleImage(ctx, img, THUMB_WIDTH, THUMB_HEIGHT, thumbX, thumbY, {
                tag: 'thread_snapshot/thumb',
            });
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
        const { _wrappedLines: lines, _bubbleWidth: bw } = post;

        ctx.fillStyle = BUBBLE_FILL_COLOR;
        drawRoundedRect(ctx, bubbleX, y, bw, post._bubbleHeight, 12);

        ctx.font = BODY_FONT;
        ctx.fillStyle = PRIMARY_TEXT_COLOR;
        lines.forEach((line, i) => {
            ctx.fillText(line, bubbleX + BUBBLE_TEXT_INSET, y + 32 + i * LINE_HEIGHT);
        });

        const lineHeight = LINE_HEIGHT;
        const textHeight = lines.length * lineHeight + 24;
        const contentHeight = Math.max(textHeight, thumbnailDrawn ? THUMB_HEIGHT : 0);
        const timestampY = y + contentHeight + 20;

        ctx.font = `12px ${FONT_FAMILY}`;
        ctx.fillStyle = TIMESTAMP_TEXT_COLOR;
        ctx.fillText(
            formatAbsoluteTimestamp(date_epoch * 1000, post.reply_to_epoch ? post.reply_to_epoch * 1000 : null),
            bubbleX,
            timestampY
        );

        return {
            y: timestampY + 30,
            anchor: { avatarX, avatarY, bubbleX, bubbleY: y }
        };
    }
    else if (thumbnailDrawn) {
        ctx.font = `12px ${FONT_FAMILY}`;
        ctx.fillStyle = TIMESTAMP_TEXT_COLOR;
        ctx.fillText(
            formatAbsoluteTimestamp(date_epoch * 1000, post.reply_to_epoch ? post.reply_to_epoch * 1000 : null),
            contentX,
            timestampY
        );

        return {
            y: timestampY + 30,
            anchor: { avatarX, avatarY, bubbleX: contentX, bubbleY: y }
        };
    } else {
        return {
            y: y + 30,
            anchor: { avatarX, avatarY, bubbleX: contentX, bubbleY: y }
        };
    }
}

async function renderThreadSnapshotCanvas({ posts, isTruncated }) {

    const tmpCanvas = createCanvas(1, 1);
    const tmpCtx = tmpCanvas.getContext('2d');

    let totalHeight = PADDING_Y;

    if (isTruncated) {
        totalHeight += 60;
    }

    for (const post of posts) {
        tmpCtx.font = BODY_FONT;
        const displayText = buildDisplayText(post);
        const contentX = PADDING_X + AVATAR_SIZE + 10;
        const bubbleX = post._mediaThumbnailUrl
            ? (contentX + THUMB_WIDTH + THUMB_MARGIN_RIGHT)
            : contentX;

        const maxTextWidth = Math.max(
            1,
            MAX_WIDTH - bubbleX - THREAD_RIGHT_PAD - INNER_BUBBLE_PADDING
        );

        const wrapped = threadBubbleWrapText(tmpCtx, displayText, maxTextWidth, MAX_THREAD_LINES);
        const maxLineWidth = Math.max(...wrapped.map(l => tmpCtx.measureText(l).width));
        const baseHeight = wrapped.length * LINE_HEIGHT + 24;

        post._displayText = displayText;
        post._wrappedLines = wrapped;
        post._bubbleWidth = Math.max(maxLineWidth + INNER_BUBBLE_PADDING, MIN_BUBBLE_WIDTH);
        post._bubbleHeight = Math.max(baseHeight, post._mediaThumbnailUrl ? THUMB_HEIGHT : 0);

        totalHeight += AVATAR_SIZE - 20 + post._bubbleHeight + 30 + 20;
    }

    totalHeight += PADDING_Y;

    const effectiveWidth = MAX_WIDTH;

    const canvas = createCanvas(effectiveWidth, totalHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = BACKGROUND_COLOR;
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
        const result = await renderPost(ctx, post, y);
        y = result.y;
        postAnchors.push(result.anchor);
    }

    ctx.strokeStyle = DIVIDER_COLOR;
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
