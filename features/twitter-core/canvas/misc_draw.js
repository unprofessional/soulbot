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

function withTrailingEllipsis(text) {
    const line = String(text || '').trimEnd();
    if (!line) return '...';
    if (/[.]{3}$|…$/.test(line)) return line;
    return `${line}...`;
}

function truncateToFitWithEllipsis(text, maxChars) {
    const line = String(text || '').trimEnd();
    if (maxChars <= 0) return '';
    if (line.length <= maxChars) return line;
    if (maxChars <= 3) return '.'.repeat(maxChars);

    return withTrailingEllipsis(line.slice(0, Math.max(0, maxChars - 3)));
}

function condenseTranslatedDisplayLines(lines, { maxSourceLines = 3 } = {}) {
    if (!Array.isArray(lines) || lines.length === 0) return [];

    const markerIndex = lines.findIndex(isTranslationMarkerLine);
    if (markerIndex <= 0) return lines;

    const sourceLines = lines
        .slice(0, markerIndex)
        .map(line => String(line || '').trim())
        .filter(Boolean);

    const trailingLines = lines.slice(markerIndex);

    if (sourceLines.length === 0) return trailingLines;
    if (sourceLines.length <= maxSourceLines) return [...sourceLines, ...trailingLines];

    const truncatedSourceLines = sourceLines.slice(0, maxSourceLines);
    truncatedSourceLines[maxSourceLines - 1] = withTrailingEllipsis(truncatedSourceLines[maxSourceLines - 1]);

    return [...truncatedSourceLines, ...trailingLines];
}

function trimRenderedLinesToMaxChars(lines, maxChars) {
    if (!Array.isArray(lines) || lines.length === 0) return [];
    if (!Number.isFinite(maxChars) || maxChars <= 0) return lines;

    const renderedLength = lines.join('\n').length;
    if (renderedLength <= maxChars) return lines;

    const out = [];
    let used = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = String(lines[i] || '');
        const separatorLen = out.length > 0 ? 1 : 0;
        const remaining = maxChars - used - separatorLen;

        if (remaining <= 0) break;
        if (line.length <= remaining) {
            out.push(line);
            used += separatorLen + line.length;
            continue;
        }

        out.push(truncateToFitWithEllipsis(line, remaining));
        used = maxChars;
        break;
    }

    if (out.length === 0) return [withTrailingEllipsis(lines[0] || '')];

    return out;
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
    condenseTranslatedDisplayLines,
    drawTextWithSpacing,
    embedCommunityNote,
    getYPosFromLineHeight,
    drawDescriptionLines,
    getTranslationMarkerFont,
    isTranslationMarkerLine,
    trimRenderedLinesToMaxChars,
};
