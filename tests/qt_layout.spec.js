const { computeQtSizing } = require('../features/twitter-post/canvas/qt_layout.js');

function makeCtx() {
    return {
        font: '',
        measureText: jest.fn(text => ({ width: String(text || '').length * 10 })),
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
});
