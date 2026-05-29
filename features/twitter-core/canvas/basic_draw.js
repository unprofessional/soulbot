/* eslint-disable no-empty */
// features/twitter-core/canvas/basic_draw.js

const { formatTwitterFooter } = require('../utils');
const { getMainLineHeight, getMainTextX } = require('../layout/geometry');
const { drawDescriptionLines } = require('./misc_draw');

const {
    MAIN_FONT,
    NAME_FONT,
    NAME_BOLD_FONT,
    FOOTER_FONT,
} = require('../../twitter-post/canvas/constants');

/**
 * Debug block: renders multiple fonts side-by-side to visually inspect spacing
 */
function drawFontDebugBlock(ctx, startX = 30, startY = 320) {
    const samples = [
        { label: 'Arial', font: '18px Arial' },
        { label: 'Liberation Sans', font: '18px "Liberation Sans"' },
        { label: 'DejaVu Sans', font: '18px "DejaVu Sans"' },
        { label: 'Noto Sans', font: '18px "Noto Sans"' },
        { label: 'Emoji Only', font: '18px "Noto Color Emoji"' },
        { label: 'Final Chain', font: FOOTER_FONT },
    ];

    const sampleText = '7:10 PM Eastern · Apr 2, 2026';
    let y = startY;

    for (const { label, font } of samples) {
        ctx.fillStyle = '#888';
        ctx.font = '12px "Liberation Sans"';
        ctx.fillText(label, startX, y);

        ctx.fillStyle = 'white';
        ctx.font = font;
        ctx.fillText(sampleText, startX + 140, y);

        console.log(`[font-debug] label=${label} font=${font}`);
        console.log(
            `[font-debug] width=${ctx.measureText(sampleText).width} text="${sampleText}"`
        );

        y += 22;
    }
}

function drawBasicElements(ctx, fontChain, metadata, favicon, pfp, descLines, options) {
    const {
        yOffset = 0,
        canvasHeightOffset = 0,
        hasImgs = false,
        hasVids = false,
        layoutMode = 'compact',
        footerY,
        debugFonts = false,
    } = options;

    if (favicon) {
        try { ctx.drawImage(favicon, ctx.canvas.width - 50, 20, 32, 32); } catch {}
    }

    ctx.textDrawingMode = 'glyph';

    // Name
    ctx.fillStyle = 'white';
    ctx.font = NAME_BOLD_FONT;
    ctx.fillText(String(metadata.authorUsername || ''), 100, 40);

    // Handle
    ctx.fillStyle = 'gray';
    ctx.font = NAME_FONT;
    ctx.fillText(`@${String(metadata.authorNick || '')}`, 100, 60);

    // Description (uses SAME font as measurement)
    ctx.fillStyle = 'white';
    ctx.font = MAIN_FONT;
    const descX = getMainTextX({ hasImgs, hasVids, layoutMode });
    const lineHeight = getMainLineHeight({ layoutMode });
    drawDescriptionLines(ctx, descLines, descX, yOffset, { lineHeight });

    // Footer
    let footerStr = metadata._displayDateFooter || formatTwitterFooter(metadata, { label: 'canvas.basic/footer' });
    if (footerStr && metadata._replyDelta) footerStr += ` · ${metadata._replyDelta}`;

    const resolvedFooterY = Number.isFinite(footerY)
        ? footerY
        : Math.max(0, canvasHeightOffset - 20);

    if (footerStr) {
        ctx.fillStyle = 'gray';
        ctx.font = FOOTER_FONT;
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

    // 🔥 Debug overlay (optional)
    if (debugFonts) {
        drawFontDebugBlock(ctx);
    }
}

function drawDesktopLayout(ctx, fontChain, metadata, favicon, pfp, descLines, options) {
    const {
        yOffset = 0,
        canvasHeightOffset = 0,
        hasImgs = false,
        hasVids = false,
        lineHeight = getMainLineHeight({ layoutMode: 'desktop' }),
        footerY,
        debugFonts = false,
    } = options;

    const hasMedia = hasImgs || hasVids;
    const padding = 30;
    const leftColumnWidth = 150;

    ctx.textDrawingMode = 'glyph';

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

    ctx.fillStyle = 'white';
    ctx.font = NAME_BOLD_FONT;
    ctx.fillText(String(metadata.authorUsername || ''), padding, avatarY + avatarRadius * 2 + 30);

    ctx.fillStyle = 'gray';
    ctx.font = NAME_FONT;
    ctx.fillText(`@${String(metadata.authorNick || '')}`, padding, avatarY + avatarRadius * 2 + 55);

    const textX = hasMedia ? (padding + leftColumnWidth) : padding;
    const textY = yOffset;

    ctx.fillStyle = 'white';
    ctx.font = MAIN_FONT;
    drawDescriptionLines(ctx, descLines, textX, textY, { lineHeight });

    let footerStr = metadata._displayDateFooter || formatTwitterFooter(metadata, { label: 'canvas.basic/footer' });
    if (footerStr && metadata._replyDelta) footerStr += ` · ${metadata._replyDelta}`;

    const resolvedFooterY = Number.isFinite(footerY)
        ? footerY
        : Math.max(0, canvasHeightOffset - 20);

    if (footerStr) {
        ctx.fillStyle = 'gray';
        ctx.font = FOOTER_FONT;
        ctx.fillText(footerStr, 30, resolvedFooterY);
    }

    if (favicon) {
        try { ctx.drawImage(favicon, ctx.canvas.width - 50, 20, 32, 32); } catch {}
    }

    if (debugFonts) {
        drawFontDebugBlock(ctx);
    }
}

module.exports = {
    drawBasicElements,
    drawDesktopLayout,
};
