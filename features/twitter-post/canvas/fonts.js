// features/twitter-post/canvas/fonts.js

const { registerFont } = require('canvas');
const fs = require('fs');

/**
 * Deterministic font registration.
 *
 * We explicitly register ONLY the fonts we want.
 * No directory scanning. No guessing. No surprises.
 */

const FONT_PATHS = [
    {
        file: '/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf',
        family: 'Noto Sans JP',
    },
    {
        file: '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
        family: 'Noto Color Emoji',
    },
];

/**
 * Registers only explicitly defined fonts.
 */
function registerFonts() {
    const registered = [];
    const skipped = [];

    for (const { file, family } of FONT_PATHS) {
        try {
            if (!fs.existsSync(file)) {
                skipped.push({ file, reason: 'file not found' });
                continue;
            }

            registerFont(file, { family });
            registered.push({ file, family });
        } catch (err) {
            skipped.push({
                file,
                reason: `registerFont failed: ${err?.message ?? String(err)}`,
            });
        }
    }

    return { registered, skipped };
}

module.exports = {
    registerFonts,
};
