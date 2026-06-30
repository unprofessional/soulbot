jest.mock('canvas', () => ({
    registerFont: jest.fn(),
}));

const { registerFont } = require('canvas');
const {
    FONT_DEFINITIONS,
    registerFonts,
} = require('../features/twitter-post/canvas/fonts.js');
const {
    TEXT_FONT_FAMILY,
} = require('../features/twitter-post/canvas/constants.js');

describe('twitter canvas font registration', () => {
    beforeEach(() => {
        registerFont.mockClear();
    });

    test('registers bundled fallback fonts for decorative usernames', () => {
        const result = registerFonts();
        const registeredFamilies = result.registered.map(font => font.family);

        expect(registeredFamilies).toEqual(expect.arrayContaining([
            'Noto Sans Math',
            'Noto Sans Old Italic',
            'Noto Sans Cherokee',
            'Noto Serif Tibetan',
            'Noto Color Emoji',
            'Noto Emoji',
        ]));
        expect(registerFont).toHaveBeenCalledWith(
            expect.stringContaining('NotoSansOldItalic-Regular.ttf'),
            { family: 'Noto Sans Old Italic' }
        );
        expect(registerFont).toHaveBeenCalledWith(
            expect.stringContaining('NotoSansCherokee[wght].ttf'),
            { family: 'Noto Sans Cherokee' }
        );
        expect(registerFont).toHaveBeenCalledWith(
            expect.stringContaining('NotoSerifTibetan[wght].ttf'),
            { family: 'Noto Serif Tibetan' }
        );
        expect(registerFont).toHaveBeenCalledWith(
            expect.stringContaining('NotoEmoji[wght].ttf'),
            { family: 'Noto Emoji' }
        );
    });

    test('keeps bundled text font definitions aligned with the shared font chain', () => {
        const bundledFamilies = FONT_DEFINITIONS.map(font => font.family);

        for (const family of [
            'Noto Sans Math',
            'Noto Sans Old Italic',
            'Noto Sans Cherokee',
            'Noto Serif Tibetan',
        ]) {
            expect(bundledFamilies).toContain(family);
            expect(TEXT_FONT_FAMILY).toContain(`"${family}"`);
        }
    });

    test('keeps emoji fonts registered without putting them in the text chain', () => {
        const bundledFamilies = FONT_DEFINITIONS.map(font => font.family);

        for (const family of [
            'Noto Color Emoji',
            'Noto Emoji',
        ]) {
            expect(bundledFamilies).toContain(family);
            expect(TEXT_FONT_FAMILY).not.toContain(`"${family}"`);
        }
    });
});
