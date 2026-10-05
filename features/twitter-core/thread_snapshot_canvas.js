const { createCanvas, loadImage } = require('canvas');
const { threadBubbleWrapText } = require('./canvas/text_wrap');
const { cropSingleImage } = require('../twitter-post/crop_single_image');
const { drawXLogo } = require('./canvas/x_logo');
const { DESKTOP_MAX_WIDTH, MAIN_FONT, TEXT_FONT_FAMILY } = require('../twitter-post/canvas/constants');
const { buildDisplayText } = require('./translation_service');
const { formatTwitterFooter } = require('./utils');

const CONTENT_X = 110;
const RIGHT_PAD = 40;
const LINE_HEIGHT = 32;
const MUTED = '#71767b';
const DIVIDER = '#2f3336';

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
    let result = formatTwitterFooter(new Date(ms));
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

function fitText(ctx, value, width) {
    let text = String(value || '');
    if (ctx.measureText(text).width <= width) return text;
    while (text.length && ctx.measureText(`${text}…`).width > width) text = text.slice(0, -1);
    return `${text}…`;
}

async function renderThreadSnapshotCanvas({ posts, isTruncated }) {
    const measure = createCanvas(1, 1).getContext('2d');
    let nextY = isTruncated ? 100 : 40;
    // Resolve media before measurement so failed thumbnails leave no empty space.
    const rows = [];
    for (const post of posts) {
        const load = async url => { try { return url ? await loadImage(url) : null; } catch { return null; } };
        const [avatar, media] = await Promise.all([load(post.user_profile_image_url), load(post._mediaThumbnailUrl)]);
        measure.font = MAIN_FONT;
        const text = buildDisplayText(post).trim();
        const lines = text ? threadBubbleWrapText(measure, text, DESKTOP_MAX_WIDTH - CONTENT_X - RIGHT_PAD, 16) : [];
        post._wrappedLines = lines;
        const mediaWidth = media ? Math.min(520, media.width / media.height * 290) : 0;
        const mediaHeight = media ? Math.min(290, mediaWidth * media.height / media.width) : 0;
        const bodyY = nextY + 40;
        const mediaY = bodyY + lines.length * LINE_HEIGHT + (lines.length && media ? 12 : 0);
        const footerY = mediaY + mediaHeight + 28;
        rows.push({ post, avatar, media, lines, y: nextY, bodyY, mediaY, mediaWidth, mediaHeight, footerY });
        nextY = footerY + 44;
    }
    const canvas = createCanvas(DESKTOP_MAX_WIDTH, Math.max(120, nextY - 12));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textDrawingMode = 'glyph';
    if (isTruncated) {
        ctx.font = `18px ${TEXT_FONT_FAMILY}`;
        ctx.fillStyle = MUTED;
        ctx.fillText('Earlier replies not shown', CONTENT_X, 48);
    }
    for (const [i, row] of rows.entries()) {
        const { post, avatar, media, lines, y, bodyY, mediaY, mediaWidth, mediaHeight, footerY } = row;
        if (i < rows.length - 1) {
            ctx.strokeStyle = DIVIDER;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(65, y + 58);
            ctx.lineTo(65, rows[i + 1].y - 8);
            ctx.stroke();
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(65, y + 25, 25, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = DIVIDER;
        ctx.fillRect(40, y, 50, 50);
        if (avatar) ctx.drawImage(avatar, 40, y, 50, 50);
        ctx.restore();

        ctx.font = `bold 22px ${TEXT_FONT_FAMILY}`;
        ctx.fillStyle = '#e7e9ea';
        const name = fitText(ctx, post.user_name, 540);
        ctx.fillText(name, CONTENT_X, y + 22);
        const handleX = CONTENT_X + ctx.measureText(name).width + 10;
        ctx.font = `20px ${TEXT_FONT_FAMILY}`;
        ctx.fillStyle = MUTED;
        ctx.fillText(fitText(ctx, `@${post.user_screen_name}`, DESKTOP_MAX_WIDTH - handleX - 100), handleX, y + 22);
        if (i === 0) drawXLogo(ctx, DESKTOP_MAX_WIDTH - 68, y, 28);
        ctx.font = MAIN_FONT;
        ctx.fillStyle = '#e7e9ea';
        lines.forEach((line, index) => ctx.fillText(line, CONTENT_X, bodyY + 24 + index * LINE_HEIGHT));
        if (media) {
            ctx.save();
            drawRoundedRect(ctx, CONTENT_X, mediaY, mediaWidth, mediaHeight, 16, false);
            ctx.clip();
            cropSingleImage(ctx, media, mediaWidth, mediaHeight, CONTENT_X, mediaY, { tag: 'thread_snapshot/thumb' });
            ctx.restore();
            ctx.strokeStyle = DIVIDER;
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, CONTENT_X, mediaY, mediaWidth, mediaHeight, 16, false);
        }
        ctx.font = `18px ${TEXT_FONT_FAMILY}`;
        ctx.fillStyle = MUTED;
        ctx.fillText(formatAbsoluteTimestamp(post.date_epoch * 1000, i ? posts[i - 1].date_epoch * 1000 : null), CONTENT_X, footerY);
    }
    return canvas.toBuffer('image/png');
}

module.exports = { renderThreadSnapshotCanvas };
