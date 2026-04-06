const {
    condenseTranslatedDisplayLines,
    drawDescriptionLines,
    getTranslationMarkerFont,
    isTranslationMarkerLine,
    trimRenderedLinesToMaxChars,
} = require('../features/twitter-core/canvas/misc_draw.js');

describe('misc_draw translation marker styling', () => {
    test('detects translation marker lines', () => {
        expect(isTranslationMarkerLine('[Translated from PT]')).toBe(true);
        expect(isTranslationMarkerLine('plain text')).toBe(false);
    });

    test('reduces font size for translation markers', () => {
        expect(getTranslationMarkerFont('24px "Liberation Sans"')).toBe('18px "Liberation Sans"');
        expect(getTranslationMarkerFont('18px "Liberation Sans"')).toBe('14px "Liberation Sans"');
    });

    test('condenses translated source text to three lines and removes blank lines', () => {
        expect(condenseTranslatedDisplayLines([
            'line 1',
            '',
            'line 2',
            'line 3',
            'line 4',
            '[Translated from PT]',
            'translated line',
        ])).toEqual([
            'line 1',
            'line 2',
            'line 3...',
            '[Translated from PT]',
            'translated line',
        ]);
    });

    test('applies max-char trimming after condensation to the final rendered lines', () => {
        const condensed = condenseTranslatedDisplayLines([
            'source line 1',
            'source line 2',
            'source line 3',
            'source line 4',
            '[Translated from PT]',
            'translated line 1',
            'translated line 2',
        ]);

        expect(condensed).toEqual([
            'source line 1',
            'source line 2',
            'source line 3...',
            '[Translated from PT]',
            'translated line 1',
            'translated line 2',
        ]);

        expect(trimRenderedLinesToMaxChars(condensed, 62)).toEqual([
            'source line 1',
            'source line 2',
            'source line 3...',
            '[Translated from...',
        ]);
    });

    test('drawDescriptionLines draws translation markers in smaller gray text', () => {
        const calls = [];
        const ctx = {
            font: '24px "Liberation Sans"',
            fillStyle: '#fff',
            fillText: jest.fn((text, x, y) => {
                calls.push({ text, x, y, font: ctx.font, fillStyle: ctx.fillStyle });
            }),
        };

        drawDescriptionLines(ctx, ['Original line', '[Translated from PT]', 'Translated line'], 30, 80, {
            lineHeight: 30,
        });

        expect(calls[0]).toEqual(expect.objectContaining({
            text: 'Original line',
            font: '24px "Liberation Sans"',
            fillStyle: '#fff',
        }));
        expect(calls[1]).toEqual(expect.objectContaining({
            text: '[Translated from PT]',
            font: '18px "Liberation Sans"',
            fillStyle: '#71767b',
        }));
        expect(calls[2]).toEqual(expect.objectContaining({
            text: 'Translated line',
            font: '24px "Liberation Sans"',
            fillStyle: '#fff',
        }));
    });
});
