const {
    calculateQuoteHeight,
    computeQtSizing,
} = require('../features/twitter-post/canvas/qt_layout.js');

function makeCtx() {
    return {
        font: '',
        measureText: jest.fn(text => ({ width: String(text || '').length * 10 })),
    };
}

function makeFontSensitiveCtx() {
    return {
        font: '',
        measureText: jest.fn(function (text) {
            const value = String(text || '');
            const widthPerChar = this.font.includes('Noto Color Emoji') ? 20 : 10;
            return { width: value.length * widthPerChar };
        }),
    };
}

describe('computeQtSizing', () => {
    test('uses full-width wrapping when QT image is expanded', () => {
        const qtMetadata = {
            description: 'alpha alpha alpha alpha alpha alpha alpha alpha',
            mediaExtended: [{
                type: 'image',
                size: { width: 1200, height: 800 },
            }],
        };

        const result = computeQtSizing(makeCtx(), {
            qtMetadata,
            qtMedia: qtMetadata.mediaExtended,
            qtFirst: qtMetadata.mediaExtended[0],
            hasImgs: false,
            hasVids: false,
            fontChain: 'sans-serif',
            maxQtDescChars: 500,
        });

        expect(result.expandQtMedia).toBe(true);
        expect(qtMetadata.description).not.toContain('\n');
    });

    test('keeps compact wrapping when the primary tweet already has media', () => {
        const qtMetadata = {
            description: 'alpha alpha alpha alpha alpha alpha alpha alpha',
            mediaExtended: [{
                type: 'image',
                size: { width: 1200, height: 800 },
            }],
        };

        const result = computeQtSizing(makeCtx(), {
            qtMetadata,
            qtMedia: qtMetadata.mediaExtended,
            qtFirst: qtMetadata.mediaExtended[0],
            hasImgs: true,
            hasVids: false,
            fontChain: 'sans-serif',
            maxQtDescChars: 500,
        });

        expect(result.expandQtMedia).toBe(false);
        expect(qtMetadata.description).toContain('\n');
    });

    test('keeps compact wrapping when QT primary media is a video', () => {
        const qtMetadata = {
            description: 'alpha alpha alpha alpha alpha alpha alpha alpha',
            mediaExtended: [{
                type: 'video',
                size: { width: 1200, height: 800 },
            }],
        };

        const result = computeQtSizing(makeCtx(), {
            qtMetadata,
            qtMedia: qtMetadata.mediaExtended,
            qtFirst: qtMetadata.mediaExtended[0],
            hasImgs: false,
            hasVids: false,
            fontChain: 'sans-serif',
            maxQtDescChars: 500,
        });

        expect(result.expandQtMedia).toBe(false);
        expect(qtMetadata.description).toContain('\n');
    });

    test('compact QT with media does not reserve the old oversized bottom box for multiline text', () => {
        const qtMetadata = {
            description: 'a\na\na\na\na\na',
            mediaExtended: [{
                type: 'image',
                size: { width: 1200, height: 800 },
            }],
            _displayDateFooter: '1:23 PM EDT · Apr 7, 2026',
        };

        const height = calculateQuoteHeight(makeCtx(), qtMetadata);

        expect(height).toBe(324);
        expect(height).toBeLessThan(342);
    });

    test('compact QT with media does not reserve footer space when no footer will render', () => {
        const qtMetadata = {
            description: 'short line',
            mediaExtended: [{
                type: 'image',
                size: { width: 1200, height: 800 },
            }],
            _displayDateFooter: '',
        };

        const height = calculateQuoteHeight(makeCtx(), qtMetadata);

        expect(height).toBe(267);
    });

    test('text-only non-expanded QT no longer uses the oversized expanded-layout bottom padding', () => {
        const qtMetadata = {
            description: 'short line',
            mediaExtended: [],
            _displayDateFooter: '1:23 PM EDT · Apr 7, 2026',
        };

        const height = calculateQuoteHeight(makeCtx(), qtMetadata);

        expect(height).toBe(174);
        expect(height).toBeLessThan(192);
    });

    test('text-only non-expanded QT without footer only keeps the compact bottom gap', () => {
        const qtMetadata = {
            description: 'short line',
            mediaExtended: [],
            _displayDateFooter: '',
        };

        const height = calculateQuoteHeight(makeCtx(), qtMetadata);

        expect(height).toBe(142);
    });

    test('calculateQuoteHeight uses the same font metrics as measureQtTextNeed', () => {
        const qtMetadata = {
            description: 'alpha alpha alpha alpha alpha alpha',
            mediaExtended: [],
            _displayDateFooter: '1:23 PM EDT · Apr 7, 2026',
        };
        const ctx = makeFontSensitiveCtx();

        const result = computeQtSizing(ctx, {
            qtMetadata,
            qtMedia: [],
            qtFirst: null,
            hasImgs: false,
            hasVids: false,
            fontChain: 'sans-serif',
            maxQtDescChars: 500,
        });

        expect(result.calcHeight).toBe(result.textNeed);
        expect(result.qtBoxHeight).toBe(result.textNeed);
    });
});
