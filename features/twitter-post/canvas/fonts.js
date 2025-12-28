// features/twitter-post/canvas/fonts.js
const { registerFont } = require('canvas');

const FONT_PATHS = [
    ['/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji'],
    ['/truetype/noto/NotoSansMath-Regular.ttf', 'Noto Sans Math'],
    ['/truetype/noto/NotoSansBamum-Regular.ttf', 'Noto Sans Bamum'],
    ['/truetype/noto/NotoSansEgyptianHieroglyphs-Regular.ttf', 'Noto Sans Egyptian Hieroglyphs'],
    ['/opentype/noto/NotoSansCJK-VF.ttf.ttc', 'Noto Sans CJK'],
];

function registerFonts(baseFontUrl = '/usr/share/fonts') {
    FONT_PATHS.forEach(([path, family]) => registerFont(`${baseFontUrl}${path}`, { family }));
}

module.exports = { registerFonts };
