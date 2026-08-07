const {
    loadJsonFixture,
} = require('./helpers/twitter_fixtures.js');

const fixture = loadJsonFixture('2020282484316090588.json');

jest.mock('child_process', () => ({
    execSync: jest.fn(() => Buffer.from('mock-font-match')),
}));

jest.mock('canvas', () => {
    const actual = jest.requireActual('canvas');
    const { resolveImageFixturePath } = require('./helpers/twitter_fixtures.js');
    const mockLocalImagePath = resolveImageFixturePath('https://pbs.twimg.com/media/HAl8NMKacAUhar2.jpg');

    return {
        ...actual,
        loadImage: jest.fn(async (src) => {
            if (src === 'https://pbs.twimg.com/media/HAl8NMKacAUhar2.jpg') {
                return actual.loadImage(mockLocalImagePath);
            }

            return actual.createCanvas(8, 8);
        }),
    };
});

const { createTwitterCanvas } = require('../features/twitter-post/twitter_canvas.js');
const { TEXT_FONT_FAMILY } = require('../features/twitter-post/canvas/constants.js');

describe('twitter image canvas deterministic fixture rendering', () => {
    let logSpy;
    let debugSpy;
    let warnSpy;
    let errorSpy;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        debugSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('renders a local-fixture JPEG without downloading remote image assets', async () => {
        const buffer = await createTwitterCanvas(fixture, true);

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.subarray(0, 4).toString('hex')).toBe('89504e47');
        expect(buffer.length).toBeGreaterThan(1000);
    }, 30000);

    test('renders simple Japanese text and ordinary numbers with the text font chain', async () => {
        const textFixture = {
            ...fixture,
            hasMedia: false,
            mediaURLs: [],
            media_extended: [],
            text: '日本語テスト 1234567890',
        };

        const buffer = await createTwitterCanvas(textFixture, false);
        const probe = jest.requireActual('canvas').createCanvas(400, 100).getContext('2d');
        probe.font = `24px ${TEXT_FONT_FAMILY}`;

        expect(buffer.subarray(0, 4).toString('hex')).toBe('89504e47');
        expect(probe.measureText('1234567890').width).toBeLessThan(180);
        expect(probe.measureText('日本語テスト 1234567890').width)
            .toBeGreaterThan(probe.measureText('1234567890').width);
        expect(TEXT_FONT_FAMILY).not.toContain('Noto Color Emoji');
        expect(TEXT_FONT_FAMILY).not.toContain('Noto Emoji');
    }, 30000);
});
