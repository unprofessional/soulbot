jest.mock('canvas', () => {
    const actual = jest.requireActual('canvas');

    return {
        ...actual,
        loadImage: jest.fn(async () => actual.createCanvas(4, 4)),
    };
});

const os = require('node:os');
const path = require('node:path');
const {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    statSync,
} = require('node:fs');

const { buildPathsAndStuff } = require('../features/twitter-core/path_builder.js');
const { bakeImageAsFilterIntoVideo } = require('../features/twitter-video/index.js');
const { cleanup } = require('../features/twitter-video/cleanup.js');
const { createTwitterVideoCanvas } = require('../features/twitter-video/twitter_video_canvas.js');
const {
    loadJsonFixture,
    resolveVideoFixturePath,
} = require('./helpers/twitter_fixtures.js');

describe('twitter video canvas frame embedding and file output testing', () => {
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

    test('renders a local fixture video without downloading from Twitter CDN', async () => {
        const metadata = loadJsonFixture('1486771164475232260.json');
        const videoUrl = metadata.mediaURLs[0];
        const localFixtureVideoPath = resolveVideoFixturePath(videoUrl);
        const processingDir = mkdtempSync(path.join(os.tmpdir(), 'soulbot-twitter-video-'));
        const pathInfo = buildPathsAndStuff(processingDir, videoUrl);
        const videoInputPath = pathInfo.localVideoOutputPath;
        const canvasInputPath = `${pathInfo.localWorkingPath}/${pathInfo.filename}.png`;
        const videoOutputPath = `${pathInfo.localWorkingPath}/${pathInfo.filename}-output.mp4`;

        mkdirSync(pathInfo.localWorkingPath, { recursive: true });
        copyFileSync(localFixtureVideoPath, videoInputPath);

        const { canvasHeight, canvasWidth, heightShim } = await createTwitterVideoCanvas({
            ...metadata,
            _canvasOutputPath: canvasInputPath,
        });

        const mediaObject = metadata.media_extended[0].size;

        await bakeImageAsFilterIntoVideo(
            videoInputPath,
            canvasInputPath,
            videoOutputPath,
            mediaObject.height,
            mediaObject.width,
            canvasHeight,
            canvasWidth,
            heightShim,
        );

        expect(existsSync(canvasInputPath)).toBe(true);
        expect(existsSync(videoOutputPath)).toBe(true);
        expect(statSync(videoOutputPath).size).toBeGreaterThan(0);

        await cleanup([], [pathInfo.localWorkingPath]);
    }, 60000);
});
