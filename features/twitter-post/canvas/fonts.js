// features/twitter-post/canvas/fonts.js

const { registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const FONT_DEFINITIONS = [
    { file: 'fonts/truetype/noto/NotoSans-Regular.ttf', family: 'Noto Sans' },
    { file: 'fonts/truetype/noto/NotoSansMath-Regular.ttf', family: 'Noto Sans Math' },
    { file: 'fonts/truetype/noto/NotoSansOldItalic-Regular.ttf', family: 'Noto Sans Old Italic' },
    { file: 'fonts/truetype/noto/NotoSansCherokee[wght].ttf', family: 'Noto Sans Cherokee' },
    { file: 'fonts/truetype/noto/NotoColorEmoji.ttf', family: 'Noto Color Emoji' },
    { file: 'fonts/truetype/noto/NotoSansLinearA-Regular.ttf', family: 'Noto Sans Linear A' },
    { file: 'fonts/truetype/noto/NotoSansLinearB-Regular.ttf', family: 'Noto Sans Linear B' },
    { file: 'fonts/truetype/noto/NotoSansEgyptianHieroglyphs-Regular.ttf', family: 'Noto Sans Egyptian Hieroglyphs' },
    { file: 'fonts/truetype/noto/NotoSansOriya-Regular.ttf', family: 'Noto Sans Oriya' },
    { file: 'fonts/truetype/noto/NotoSansBamum-Regular.ttf', family: 'Noto Sans Bamum' },
    { file: 'fonts/truetype/noto/NotoSansVai-Regular.ttf', family: 'Noto Sans Vai' },
    { file: 'fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc', family: 'Noto Sans CJK JP' },
];

const SYSTEM_FONT_DEFINITIONS = [
    { file: '/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf', family: 'Noto Sans JP' },
];

/**
 * Registers only explicitly defined fonts.
 */
function registerFonts() {
    const registered = [];
    const skipped = [];
    const definitions = [
        ...FONT_DEFINITIONS.map(definition => ({
            ...definition,
            file: path.join(PROJECT_ROOT, definition.file),
        })),
        ...SYSTEM_FONT_DEFINITIONS,
    ];

    for (const definition of definitions) {
        try {
            if (fs.existsSync(definition.file)) {
                registerFont(definition.file, { family: definition.family });
                registered.push({ file: definition.file, family: definition.family });
            } else {
                skipped.push({ ...definition, reason: 'not found' });
            }
        } catch (err) {
            skipped.push({ ...definition, reason: err.message });
        }
    }

    return { registered, skipped };
}

module.exports = {
    FONT_DEFINITIONS,
    registerFonts,
};
