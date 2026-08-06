jest.mock('canvas', () => {
    const actual = jest.requireActual('canvas');
    return {
        ...actual,
        loadImage: jest.fn(async () => actual.createCanvas(4, 4)),
    };
});

const os = require('node:os');
const path = require('node:path');
const { copyFileSync, mkdirSync, mkdtempSync, rmSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { bakeImageAsFilterIntoVideo } = require('../features/twitter-video/index.js');
const { createTwitterVideoCanvas } = require('../features/twitter-video/twitter_video_canvas.js');
const { createVideoPerformanceTelemetry } = require('../features/twitter-video/performance_telemetry.js');
const {
    loadJsonFixture,
    resolveVideoFixturePath,
} = require('./helpers/twitter_fixtures.js');

const execFileAsync = promisify(execFile);

async function probe(filePath) {
    const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration:stream=codec_type,width,height,start_time,duration',
        '-of', 'json',
        filePath,
    ]);
    return JSON.parse(stdout);
}

async function videoSsim(firstPath, secondPath) {
    const { stderr } = await execFileAsync('ffmpeg', [
        '-v', 'info',
        '-i', firstPath,
        '-i', secondPath,
        '-lavfi', 'ssim',
        '-f', 'null',
        '-',
    ]);
    const match = String(stderr).match(/All:([0-9.]+)/);
    if (!match) throw new Error('ffmpeg did not emit SSIM output');
    return Number(match[1]);
}

describe('Twitter video conditional normalization media paths', () => {
    test('direct and forced-normalization paths retain equivalent output', async () => {
        const root = mkdtempSync(path.join(os.tmpdir(), 'soulbot-normalization-paths-'));
        const workingDir = path.join(root, 'working');
        const inputPath = path.join(workingDir, 'input.mp4');
        const canvasPath = path.join(workingDir, 'canvas.png');
        const directOutputPath = path.join(workingDir, 'direct.mp4');
        const normalizedOutputPath = path.join(workingDir, 'normalized.mp4');
        const metadata = loadJsonFixture('1486771164475232260.json');
        const sourcePath = resolveVideoFixturePath(metadata.mediaURLs[0]);
        const decisions = [];
        const originalForceNormalization = process.env.TWIT_FORCE_NORMALIZATION;

        mkdirSync(workingDir, { recursive: true });
        copyFileSync(sourcePath, inputPath);

        try {
            delete process.env.TWIT_FORCE_NORMALIZATION;
            const layout = await createTwitterVideoCanvas({
                ...metadata,
                _canvasOutputPath: canvasPath,
            });
            const media = metadata.media_extended[0].size;
            const render = (outputPath, forceNormalization) => {
                const telemetry = createVideoPerformanceTelemetry({ logger: () => {} });
                decisions.push(telemetry);
                return bakeImageAsFilterIntoVideo(
                    inputPath,
                    canvasPath,
                    outputPath,
                    media.height,
                    media.width,
                    layout.canvasHeight,
                    layout.canvasWidth,
                    layout.heightShim,
                    { telemetry, forceNormalization },
                );
            };

            await render(directOutputPath, false);
            await render(normalizedOutputPath, true);

            expect(decisions[0].stages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    stage: 'normalization_decision',
                    path: 'direct',
                    reason: 'safe_mp4_h264_aac_timestamps',
                }),
            ]));
            expect(decisions[0].stages.some(stage => stage.stage === 'normalization_remux')).toBe(false);
            expect(decisions[1].stages).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    stage: 'normalization_decision',
                    path: 'normalized',
                    reason: 'forced_by_configuration',
                }),
            ]));

            const [directProbe, normalizedProbe] = await Promise.all([
                probe(directOutputPath),
                probe(normalizedOutputPath),
            ]);
            const directVideo = directProbe.streams.find(stream => stream.codec_type === 'video');
            const normalizedVideo = normalizedProbe.streams.find(stream => stream.codec_type === 'video');
            expect({ width: directVideo.width, height: directVideo.height }).toEqual({
                width: normalizedVideo.width,
                height: normalizedVideo.height,
            });
            expect(directProbe.streams.map(stream => stream.codec_type)).toEqual(
                normalizedProbe.streams.map(stream => stream.codec_type)
            );
            expect(Number(directProbe.format.duration)).toBeCloseTo(
                Number(normalizedProbe.format.duration),
                2,
            );
            expect(await videoSsim(directOutputPath, normalizedOutputPath)).toBeGreaterThan(0.999);
        } finally {
            if (originalForceNormalization === undefined) delete process.env.TWIT_FORCE_NORMALIZATION;
            else process.env.TWIT_FORCE_NORMALIZATION = originalForceNormalization;
            rmSync(root, { recursive: true, force: true });
        }
    }, 60000);
});
