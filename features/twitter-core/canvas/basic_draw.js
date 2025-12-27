/* eslint-disable no-empty */
// features/twitter-core/canvas/basic_draw.js

const { formatTwitterFooter } = require('../utils');
const { getMainTextX, MAIN } = require('../layout/geometry');
const { drawDescriptionLines } = require('./misc_draw');

function drawBasicElements(ctx, fontChain, metadata, favicon, pfp, descLines, options) {
    const { yOffset = 0, canvasHeightOffset = 0, hasImgs = false, hasVids = false, footerY } = options;

    // Top-right icon
    if (favicon) {
        try { ctx.drawImage(favicon, 550, 20, 32, 32); } catch {}
    }

    ctx.textDrawingMode = 'glyph';

    // Display name
    ctx.fillStyle = 'white';
    ctx.font = '18px "Noto Color Emoji"';
    ctx.fillText(String(metadata.authorUsername || ''), 100, 40);

    // Handle
    ctx.fillStyle = 'gray';
    ctx.font = `18px ${fontChain}`;
    ctx.fillText(`@${String(metadata.authorNick || '')}`, 100, 60);

    // Body text
    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    const descX = getMainTextX({ hasImgs, hasVids });
    drawDescriptionLines(ctx, descLines, descX, yOffset, { lineHeight: MAIN.lineH });

    // Footer timestamp
    const footerStr = metadata._displayDateFooter || formatTwitterFooter(metadata, { label: 'canvas.basic/footer' });

    // If footerY provided, use it; otherwise keep legacy behavior
    const resolvedFooterY = Number.isFinite(footerY)
        ? footerY
        : Math.max(0, canvasHeightOffset - 20);

    if (footerStr) {
        ctx.fillStyle = 'gray';
        ctx.font = `18px ${fontChain}`;
        ctx.fillText(footerStr, 30, resolvedFooterY);
    }

    // Avatar
    if (pfp) {
        ctx.save();
        const radius = 25;
        ctx.beginPath();
        ctx.arc(20 + radius, 20 + radius, radius, 0, Math.PI * 2);
        ctx.clip();
        try { ctx.drawImage(pfp, 20, 20, 50, 50); } catch {}
        ctx.restore();
    }
}

function drawDesktopLayout(ctx, fontChain, metadata, favicon, pfp, descLines, options) {
    const {
        yOffset = 0,
        canvasHeightOffset = 0,
        hasImgs = false,
        hasVids = false,
        footerY,
    } = options;

    const hasMedia = hasImgs || hasVids;
    const padding = 30;
    const leftColumnWidth = 150;

    ctx.textDrawingMode = 'glyph';

    // Left: avatar
    const avatarRadius = 30;
    const avatarX = padding + avatarRadius;
    const avatarY = yOffset;

    if (pfp) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
        ctx.clip();
        try { ctx.drawImage(pfp, avatarX - avatarRadius, avatarY, avatarRadius * 2, avatarRadius * 2); } catch {}
        ctx.restore();
    }

    // Name + handle
    ctx.fillStyle = 'white';
    ctx.font = `bold 18px ${fontChain}`;
    ctx.fillText(String(metadata.authorUsername || ''), padding, avatarY + avatarRadius * 2 + 30);

    ctx.fillStyle = 'gray';
    ctx.font = `18px ${fontChain}`;
    ctx.fillText(`@${String(metadata.authorNick || '')}`, padding, avatarY + avatarRadius * 2 + 55);

    // Description
    const textX = hasMedia ? (padding + leftColumnWidth) : padding;
    const textY = yOffset + 100;

    ctx.fillStyle = 'white';
    ctx.font = '24px "Noto Color Emoji"';
    drawDescriptionLines(ctx, descLines, textX, textY, { lineHeight: MAIN.lineH });

    // Footer timestamp
    const footerStr = metadata._displayDateFooter || formatTwitterFooter(metadata, { label: 'canvas.desktop/footer' });

    const resolvedFooterY = Number.isFinite(footerY)
        ? footerY
        : Math.max(0, canvasHeightOffset - 20);

    if (footerStr) {
        ctx.fillStyle = 'gray';
        ctx.font = `18px ${fontChain}`;
        ctx.fillText(footerStr, 30, resolvedFooterY);
    }

    // Top-right icon
    if (favicon) {
        try { ctx.drawImage(favicon, 550, 20, 32, 32); } catch {}
    }
}

module.exports = {
    drawBasicElements,
    drawDesktopLayout,
};
