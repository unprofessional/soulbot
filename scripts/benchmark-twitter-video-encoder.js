const os = require('node:os');
const path = require('node:path');
const {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    statSync,
    writeFileSync,
} = require('node:fs');
const { createCanvas } = require('canvas');
const { performance } = require('node:perf_hooks');

const { buildPathsAndStuff } = require('../features/twitter-core/path_builder.js');
const { bakeImageAsFilterIntoVideo } = require('../features/twitter-video/index.js');
const {
    loadJsonFixture,
    resolveVideoFixturePath,
} = require('../tests/helpers/twitter_fixtures.js');

function writeSyntheticTweetCanvas(canvasPath, width, height) {
    mkdirSync(path.dirname(canvasPath), { recursive: true });

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 34px "DejaVu Sans"';
    ctx.fillText('SOULbot FFmpeg benchmark', 36, 58);

    ctx.fillStyle = '#8b98a5';
    ctx.font = '22px "DejaVu Sans"';
    ctx.fillText('Static canvas background + source video overlay', 36, 94);

    ctx.strokeStyle = '#2f3336';
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 18, width - 44, height - 36);

    writeFileSync(canvasPath, canvas.toBuffer('image/png'));
}

function formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function runOne({ encoder, runIndex, metadata }) {
    process.env.TWITTER_VIDEO_ENCODER = encoder;

    const videoUrl = metadata.mediaURLs[0];
    const localFixtureVideoPath = resolveVideoFixturePath(videoUrl);
    const processingDir = mkdtempSync(path.join(os.tmpdir(), `soulbot-video-bench-${encoder}-`));
    const pathInfo = buildPathsAndStuff(processingDir, videoUrl);
    const videoInputPath = pathInfo.localVideoOutputPath;
    const canvasInputPath = `${pathInfo.localWorkingPath}/${pathInfo.filename}.png`;
    const videoOutputPath = `${pathInfo.localWorkingPath}/${pathInfo.filename}-${encoder}-${runIndex}.mp4`;

    mkdirSync(pathInfo.localWorkingPath, { recursive: true });
    copyFileSync(localFixtureVideoPath, videoInputPath);

    const mediaObject = metadata.media_extended[0].size;
    const canvasWidth = 560;
    const canvasHeight = Math.max(720, Math.round((mediaObject.height / mediaObject.width) * 560) + 260);
    const heightShim = Math.max(0, canvasHeight - Math.round((mediaObject.height / mediaObject.width) * 560));

    writeSyntheticTweetCanvas(canvasInputPath, canvasWidth, canvasHeight);

    const startedAt = performance.now();
    try {
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
        const elapsedMs = performance.now() - startedAt;
        const outputBytes = existsSync(videoOutputPath) ? statSync(videoOutputPath).size : 0;

        return {
            encoder,
            runIndex,
            elapsedMs,
            outputBytes,
        };
    } finally {
        rmSync(processingDir, { recursive: true, force: true });
    }
}

async function main() {
    const originalEncoder = process.env.TWITTER_VIDEO_ENCODER;
    const encoders = String(process.env.BENCHMARK_ENCODERS || 'libx264,h264_nvenc')
        .split(',')
        .map(encoder => encoder.trim())
        .filter(Boolean);
    const runs = Number(process.env.BENCHMARK_RUNS || '3');
    const fixture = process.env.BENCHMARK_TWITTER_FIXTURE || '1486771164475232260.json';
    const metadata = loadJsonFixture(fixture);
    const results = [];

    console.log(JSON.stringify({
        event: 'benchmark_start',
        fixture,
        runs,
        encoders,
        nvencGpu: process.env.TWITTER_VIDEO_NVENC_GPU || null,
        nvencPreset: process.env.TWITTER_VIDEO_NVENC_PRESET || 'p4',
        nvencCq: process.env.TWITTER_VIDEO_NVENC_CQ || '23',
    }));

    try {
        for (const encoder of encoders) {
            for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
                const result = await runOne({ encoder, runIndex, metadata });
                results.push(result);
                console.log(JSON.stringify({
                    event: 'benchmark_run',
                    encoder,
                    runIndex,
                    elapsedMs: Math.round(result.elapsedMs),
                    outputBytes: result.outputBytes,
                    outputSize: formatBytes(result.outputBytes),
                }));
            }
        }
    } finally {
        if (originalEncoder === undefined) {
            delete process.env.TWITTER_VIDEO_ENCODER;
        } else {
            process.env.TWITTER_VIDEO_ENCODER = originalEncoder;
        }
    }

    for (const encoder of encoders) {
        const encoderResults = results.filter(result => result.encoder === encoder);
        if (encoderResults.length === 0) continue;

        console.log(JSON.stringify({
            event: 'benchmark_summary',
            encoder,
            runs: encoderResults.length,
            avgElapsedMs: Math.round(average(encoderResults.map(result => result.elapsedMs))),
            avgOutputBytes: Math.round(average(encoderResults.map(result => result.outputBytes))),
            avgOutputSize: formatBytes(average(encoderResults.map(result => result.outputBytes))),
        }));
    }
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: 'benchmark_error',
        message: error.message,
        stack: error.stack,
    }));
    process.exit(1);
});
