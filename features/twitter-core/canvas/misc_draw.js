// features/twitter-core/canvas/misc_draw.js

const TRANSLATION_MARKER_RE = /^\[Translated from [^\]]+\]$/;
const TRANSLATION_MARKER_COLOR = '#71767b';

function isTranslationMarkerLine(line) {
    return typeof line === 'string' && TRANSLATION_MARKER_RE.test(line.trim());
}

function getTranslationMarkerFont(font) {
    if (typeof font !== 'string' || !font.trim()) return font;
    return font.replace(/(\d+(?:\.\d+)?)px/, (_, px) => `${Math.max(14, Number(px) - 6)}px`);
}

/**
 * Renders individual letters with spacing.
 */
function drawTextWithSpacing(ctx, text, x, y, letterSpacing = 1) {
    let currentX = x;
    for (const char of text) {
        ctx.fillText(char, currentX, y);
        currentX += ctx.measureText(char).width + letterSpacing;
    }
}

function embedCommunityNote(message, noteText, title = 'Community Note:') {
    return noteText
        ? {
            color: 0x0099ff,
            title,
            description: noteText,
        }
        : undefined;
}

/**
 * Calculates y position based on line height.
 */
function getYPosFromLineHeight(descLines, y, lineHeight = 30) {
    return y + descLines.length * lineHeight;
}

/**
 * Draw already-wrapped lines with a specified lineHeight.
 * (No font set in here; callers set ctx.font for determinism.)
 */
function drawDescriptionLines(ctx, lines, x, y, { lineHeight = 30, yOffset = 0 } = {}) {
    let yy = y + yOffset;
    for (const line of lines) {
        const prevFont = ctx.font;
        const prevFillStyle = ctx.fillStyle;

        if (isTranslationMarkerLine(line)) {
            ctx.font = getTranslationMarkerFont(prevFont);
            ctx.fillStyle = TRANSLATION_MARKER_COLOR;
        }

        ctx.fillText(line, x, yy);
        ctx.font = prevFont;
        ctx.fillStyle = prevFillStyle;
        yy += lineHeight;
    }
}

module.exports = {
    drawTextWithSpacing,
    embedCommunityNote,
    getYPosFromLineHeight,
    drawDescriptionLines,
    getTranslationMarkerFont,
    isTranslationMarkerLine,
};
