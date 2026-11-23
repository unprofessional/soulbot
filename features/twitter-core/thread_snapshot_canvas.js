const { createCanvas, loadImage } = require('canvas');
const { cropSingleImage } = require('../twitter-post/crop_single_image');
const { DESKTOP_MAX_WIDTH, TEXT_FONT_FAMILY } = require('../twitter-post/canvas/constants');
const { buildDisplayText } = require('./translation_service');
const { formatTwitterFooter } = require('./utils');
const { drawDescriptionLines } = require('./canvas/misc_draw');

const PAD = 32;
const CONTENT_X = 132;
const AVATAR = 80;
const MUTED = '#71767b';
const BORDER = '#2f3336';
const WHITE = '#e7e9ea';
const font = (size, bold = false) => `${bold ? 'bold ' : ''}${size}px ${TEXT_FONT_FAMILY}`;

function rounded(ctx, x, y, w, h, r = 28) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function fit(ctx, text, width) {
    let value = String(text || '');
    if (ctx.measureText(value).width <= width) return value;
    while (value && ctx.measureText(value + '…').width > width) value = value.slice(0, -1);
    return value + '…';
}

// Preserve paragraph breaks and split long unbroken URLs/words within the column.
function wrap(ctx, text, width, limit = 80) {
    const lines = [];
    for (const paragraph of text.replace(/https:\/\/t\.co\/\S+/g, '').trim().split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/)) {
            if (line && ctx.measureText(`${line} ${word}`).width > width) {
                lines.push(line);
                line = '';
            }
            for (const char of (line ? ' ' : '') + word) {
                if (line && ctx.measureText(line + char).width > width) {
                    lines.push(line);
                    line = '';
                }
                line += char;
            }
        }
        lines.push(line);
    }
    if (lines.length > limit) return [...lines.slice(0, limit - 1), fit(ctx, lines[limit - 1] + '…', width)];
    return text.trim() ? lines : [];
}

async function load(url) {
    try { return url ? await loadImage(url) : null; } catch { return null; }
}
async function assets(post) {
    const items = post.media_extended?.length ? post.media_extended.slice(0, 4) : [{ url: post._mediaThumbnailUrl, type: 'image' }];
    const [avatar, ...images] = await Promise.all([
        load(post.user_profile_image_url),
        ...items.map(m => load(m.type === 'image' ? m.url || m.thumbnail_url : m.thumbnail_url)),
    ]);
    return { avatar, images: images.filter(Boolean) };
}
function mediaHeight(images, width) {
    if (!images.length) return 0;
    return images.length === 1 ? width / Math.max(0.75, images[0].width / images[0].height) : width * 9 / 16;
}
function drawMedia(ctx, images, x, y, width, height) {
    if (!images.length) return;
    ctx.save();
    rounded(ctx, x, y, width, height);
    ctx.clip();
    const gap = 4;
    const halfW = (width - gap) / 2;
    const halfH = (height - gap) / 2;
    const rects = images.length === 1 ? [[0, 0, width, height]]
        : images.length === 2 ? [[0, 0, halfW, height], [halfW + gap, 0, halfW, height]]
            : images.length === 3 ? [[0, 0, halfW, height], [halfW + gap, 0, halfW, halfH], [halfW + gap, halfH + gap, halfW, halfH]]
                : [[0, 0, halfW, halfH], [halfW + gap, 0, halfW, halfH], [0, halfH + gap, halfW, halfH], [halfW + gap, halfH + gap, halfW, halfH]];
    images.forEach((img, i) => {
        const [dx, dy, w, h] = rects[i];
        cropSingleImage(ctx, img, w, h, x + dx, y + dy);
    });
    ctx.restore();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    rounded(ctx, x, y, width, height);
    ctx.stroke();
}
function avatar(ctx, img, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = BORDER;
    ctx.fillRect(x, y, size, size);
    if (img) cropSingleImage(ctx, img, size, size, x, y);
    ctx.restore();
}
function badge(ctx, x, y) {
    ctx.fillStyle = '#1d9bf0';
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12;
        const radius = i % 2 ? 13 : 16;
        ctx[i ? 'lineTo' : 'moveTo'](x + 16 + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 14, y + 5);
    ctx.lineTo(x + 24, y - 6);
    ctx.stroke();
}
function header(ctx, post, img, x, y, width, expanded = false, small = false) {
    const size = small ? 44 : AVATAR;
    avatar(ctx, img, x, y, size);
    const tx = x + size + 20;
    ctx.font = font(small ? 28 : 32, true);
    ctx.fillStyle = WHITE;
    const name = fit(ctx, post.user_name, width - size - (expanded ? 80 : 290));
    ctx.fillText(name, tx, y + 31);
    const nameEnd = tx + ctx.measureText(name).width;
    if (post.user_verified) badge(ctx, nameEnd + 6, y + 20);
    ctx.font = font(30);
    ctx.fillStyle = MUTED;
    const hx = expanded ? tx : nameEnd + (post.user_verified ? 48 : 12);
    ctx.fillText(fit(ctx, `@${post.user_screen_name}`, x + width - hx - 45), hx, y + (expanded ? 70 : 31));
    if (!small) ctx.fillText('···', x + width - 38, y + 24);
}
function textLines(ctx, lines, x, y, size, lineHeight) {
    ctx.font = font(size);
    ctx.fillStyle = WHITE;
    drawDescriptionLines(ctx, lines, x, y + size, { lineHeight });
}

async function renderThreadSnapshotCanvas({ posts, isTruncated }) {
    const measure = createCanvas(1, 1).getContext('2d');
    const rows = [];
    let y = isTruncated ? 88 : PAD;
    for (const [index, post] of posts.entries()) {
        const expanded = index === posts.length - 1;
        const x = expanded ? PAD : CONTENT_X;
        const width = DESKTOP_MAX_WIDTH - x - PAD;
        const size = expanded ? 36 : 32;
        const lineHeight = expanded ? 48 : 42;
        const loaded = await assets(post);
        measure.font = font(size);
        const lines = wrap(measure, buildDisplayText(post).trim(), width);
        const bodyY = y + (expanded ? 116 : 46);
        let bottom = bodyY + lines.length * lineHeight;
        const mediaY = bottom + (lines.length ? 20 : 0);
        const height = mediaHeight(loaded.images, width);
        if (height) bottom = mediaY + height;
        let quote;
        if (post.qtMetadata) {
            const qp = post.qtMetadata;
            const qa = await assets(qp);
            measure.font = font(30);
            const qlines = wrap(measure, buildDisplayText(qp).trim(), width - (qa.images.length ? 260 : 48), 5);
            quote = { post: qp, ...qa, lines: qlines, y: bottom + 12, height: 84 + Math.max(qlines.length * 40, qa.images.length ? 200 : 0) + 24 };
            bottom = quote.y + quote.height;
        }
        const footerY = bottom + (expanded ? 48 : 0);
        rows.push({ post, ...loaded, expanded, x, width, size, lineHeight, lines, y, bodyY, mediaY, height, quote, footerY });
        y = Math.max(footerY + (expanded ? 36 : 56), y + AVATAR + 16);
    }
    const canvas = createCanvas(DESKTOP_MAX_WIDTH, Math.max(120, Math.ceil(y)));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (isTruncated) { ctx.font = font(24); ctx.fillStyle = MUTED; ctx.fillText('Earlier replies not shown', CONTENT_X, 44); }
    for (const [i, row] of rows.entries()) {
        const { post, expanded, x, width, y, quote } = row;
        if (!expanded) {
            ctx.strokeStyle = BORDER;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(PAD + AVATAR / 2, y + AVATAR + 8);
            ctx.lineTo(PAD + AVATAR / 2, rows[i + 1].y - 8);
            ctx.stroke();
        }
        header(ctx, post, row.avatar, PAD, y, DESKTOP_MAX_WIDTH - PAD * 2, expanded);
        textLines(ctx, row.lines, x, row.bodyY, row.size, row.lineHeight);
        drawMedia(ctx, row.images, x, row.mediaY, width, row.height);
        if (quote) {
            ctx.strokeStyle = BORDER;
            ctx.lineWidth = 2;
            rounded(ctx, x, quote.y, width, quote.height);
            ctx.stroke();
            header(ctx, quote.post, quote.avatar, x + 24, quote.y + 20, width - 48, false, true);
            if (quote.images.length) drawMedia(ctx, [quote.images[0]], x + 24, quote.y + 84, 200, 200);
            textLines(ctx, quote.lines, x + (quote.images.length ? 248 : 24), quote.y + 80, 30, 40);
        }
        if (expanded) {
            ctx.font = font(28);
            ctx.fillStyle = MUTED;
            const footer = formatTwitterFooter(new Date(post.date_epoch * 1000));
            ctx.fillText(footer, x, row.footerY);
        }
    }
    return canvas.toBuffer('image/png');
}
module.exports = { renderThreadSnapshotCanvas };
