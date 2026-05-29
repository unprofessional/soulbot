// features/twitter-post/canvas/fonts.js

const { registerFont } = require('canvas');
const fs = require('fs');

/**
 * Registers only explicitly defined fonts.
 */
function registerFonts() {
    const registered = [];
    const skipped = [];

    const jpFont = '/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf';

    try {
        if (fs.existsSync(jpFont)) {
            registerFont(jpFont, { family: 'Noto Sans JP' });
            registered.push({ file: jpFont, family: 'Noto Sans JP' });
        } else {
            skipped.push({ file: jpFont, reason: 'not found' });
        }
    } catch (err) {
        skipped.push({ file: jpFont, reason: err.message });
    }

    return { registered, skipped };
}

module.exports = {
    registerFonts,
};
