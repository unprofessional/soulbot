// features/twitter-post/canvas/constants.js

function numEnv(key, fallback) {
    const v = Number(process.env[key]);
    return Number.isFinite(v) ? v : fallback;
}

/**
 * 🔥 Font system (FIXED)
 * - Use Liberation Sans as primary (Arial-compatible)
 * - Use Noto Color Emoji ONLY as fallback
 */
const TEXT_FONT_FAMILY = '"Liberation Sans"';

// Main body font/metrics used in both measure and draw
const MAIN_LINE_HEIGHT = 30;
const MAIN_FONT = `24px ${TEXT_FONT_FAMILY}`;

// Additional font helpers (NEW, but non-breaking)
const NAME_FONT = `18px ${TEXT_FONT_FAMILY}`;
const NAME_BOLD_FONT = `bold 18px ${TEXT_FONT_FAMILY}`;
const FOOTER_FONT = `18px ${TEXT_FONT_FAMILY}`;

// Spacing controls for consistent vertical rhythm (text ↔ media ↔ footer ↔ QT)
const GAP_TEXT_TO_MEDIA = numEnv('CANVAS_GAP_TEXT_TO_MEDIA', 8);
const GAP_MEDIA_TO_FOOTER = numEnv('CANVAS_GAP_MEDIA_TO_FOOTER', 14);
const FOOTER_LINE_H = numEnv('CANVAS_FOOTER_LINE_H', 24);
const GAP_FOOTER_TO_QT = numEnv('CANVAS_GAP_FOOTER_TO_QT', 16);

const DEFAULT_BOTTOM_PAD_NO_QT = numEnv('CANVAS_BOTTOM_PAD_NO_QT', 8);
const DEFAULT_BOTTOM_PAD_WITH_QT = numEnv('CANVAS_BOTTOM_PAD_WITH_QT', 16);

const MAX_DESC_CHARS = 1000;
const MAX_QT_DESC_CHARS = 500;

const MAX_WIDTH = 600;
const INITIAL_HEIGHT = 650;

const FOOTER_FONT_SIZE = 18;

// In your existing logic: 1=800, 2=600, 3/4=530, default 600
function getMaxHeight(numImgs) {
    return [0, 800, 600, 530, 530][numImgs] || 600;
}

module.exports = {
    // font system
    TEXT_FONT_FAMILY,
    MAIN_FONT,
    NAME_FONT,
    NAME_BOLD_FONT,
    FOOTER_FONT,

    // layout
    MAIN_LINE_HEIGHT,
    GAP_TEXT_TO_MEDIA,
    GAP_MEDIA_TO_FOOTER,
    FOOTER_LINE_H,
    GAP_FOOTER_TO_QT,

    DEFAULT_BOTTOM_PAD_NO_QT,
    DEFAULT_BOTTOM_PAD_WITH_QT,

    MAX_DESC_CHARS,
    MAX_QT_DESC_CHARS,

    MAX_WIDTH,
    INITIAL_HEIGHT,
    FOOTER_FONT_SIZE,

    getMaxHeight,
};
