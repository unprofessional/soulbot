// features/twitter-core/canvas/misc_draw.js

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

function embedCommunityNote(message, noteText) {
    return noteText
        ? {
            color: 0x0099ff,
            title: 'Community Note:',
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
        ctx.fillText(line, x, yy);
        yy += lineHeight;
    }
}

module.exports = {
    drawTextWithSpacing,
    embedCommunityNote,
    getYPosFromLineHeight,
    drawDescriptionLines,
};
