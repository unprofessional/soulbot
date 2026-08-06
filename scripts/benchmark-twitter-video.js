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
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { createTwitterVideoCanvas } = require('../features/twitter-video/twitter_video_canvas.js');
const { bakeImageAsFilterIntoVideo } = require('../features/twitter-video/index.js');
const {
    createVideoPerformanceTelemetry,
    summarizeBenchmarkRuns,
} = require('../features/twitter-video/performance_telemetry.js');
const {
    loadJsonFixture,
    resolveVideoFixturePath,
} = require('../tests/helpers/twitter_fixtures.js');

const execFileAsync = promisify(execFile);

async function runCommand(command, args) {
    return execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024 });
}

async function probeVideo(filePath) {
    const { stdout } = await runCommand('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration,size,start_time:stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,start_time,sample_rate,channels',
        '-of', 'json',
        filePath,
    ]);
    return JSON.parse(stdout);
}

async function prepareCorpus(sourcePath, corpusDir) {
    const cases = [{ name: 'landscape_aac', path: sourcePath }];
    const definitions = [
        {
            name: 'silent',
            args: ['-y', '-i', sourcePath, '-map', '0:v:0', '-c:v', 'copy', '-an'],
        },
        {
            name: 'portrait_aac',
            args: ['-y', '-i', sourcePath, '-vf', 'transpose=1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'copy'],
        },
        {
            name: 'variable_frame_rate',
            args: ['-y', '-i', sourcePath, '-vf', 'setpts=if(eq(mod(N\\,2)\\,0)\\,PTS\\,PTS+0.04/TB)', '-fps_mode', 'vfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'copy'],
        },
        {
            name: 'audio_offset',
            args: ['-y', '-itsoffset', '0.25', '-i', sourcePath, '-i', sourcePath, '-map', '1:v:0', '-map', '0:a:0', '-c', 'copy'],
        },
        {
            name: 'negative_timestamp',
            args: ['-y', '-itsoffset', '-0.25', '-i', sourcePath, '-map', '0', '-c', 'copy', '-copyts'],
        },
        {
            name: 'near_60_seconds',
            args: ['-y', '-stream_loop', '3', '-i', sourcePath, '-t', '59', '-c', 'copy'],
        },
    ];

    for (const definition of definitions) {
        const outputPath = path.join(corpusDir, `${definition.name}.mp4`);
        await runCommand('ffmpeg', [...definition.args, outputPath]);
        cases.push({ name: definition.name, path: outputPath });
    }
    return cases;
}

function metadataForVideo(baseMetadata, probe, videoPath) {
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const localUrl = `https://benchmark.invalid/${path.basename(videoPath)}`;
    const media = {
        type: 'video',
        url: localUrl,
        size: { width: video.width, height: video.height },
        width: video.width,
        height: video.height,
    };
    return {
        ...baseMetadata,
        _videos: [media],
        media_extended: [media],
        mediaURLs: [localUrl],
    };
}

async function runCase({ benchmarkCase, baseMetadata, caseIndex, measured, benchmarkLabel }) {
    const runDir = mkdtempSync(path.join(os.tmpdir(), `soulbot-video-${benchmarkLabel}-${benchmarkCase.name}-`));
    const inputPath = path.join(runDir, 'input.mp4');
    const canvasPath = path.join(runDir, 'canvas.png');
    const outputPath = path.join(runDir, 'output.mp4');
    const events = [];
    copyFileSync(benchmarkCase.path, inputPath);

    const probe = await probeVideo(inputPath);
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const metadata = metadataForVideo(baseMetadata, probe, inputPath);
    metadata._canvasOutputPath = canvasPath;
    const telemetry = createVideoPerformanceTelemetry({
        runId: `${benchmarkLabel}-${benchmarkCase.name}-${caseIndex}`,
        context: { source: 'benchmark', case: benchmarkCase.name, measured },
        logger: line => events.push(JSON.parse(line)),
    });

    let status = 'ok';
    let error = null;
    try {
        const layout = await telemetry.measure(
            'canvas_creation',
            () => createTwitterVideoCanvas(metadata),
        );
        await bakeImageAsFilterIntoVideo(
            inputPath,
            canvasPath,
            outputPath,
            video.height,
            video.width,
            layout.canvasHeight,
            layout.canvasWidth,
            layout.heightShim,
            { telemetry },
        );
    } catch (caughtError) {
        status = 'failed';
        error = caughtError?.message || String(caughtError);
    }

    const outputProbe = existsSync(outputPath) ? await probeVideo(outputPath).catch(() => null) : null;
    const result = telemetry.finish(status, {
        case: benchmarkCase.name,
        error,
        inputBytes: statSync(inputPath).size,
        outputBytes: existsSync(outputPath) ? statSync(outputPath).size : 0,
        inputProbe: probe,
        outputProbe,
    });
    result.events = events;
    rmSync(runDir, { recursive: true, force: true });
    return result;
}

async function environmentMetadata() {
    const commandOutput = async (command, args) => {
        try {
            return (await runCommand(command, args)).stdout.trim();
        } catch {
            return null;
        }
    };
    return {
        generatedAt: new Date().toISOString(),
        hostname: os.hostname(),
        platform: `${os.platform()} ${os.release()} ${os.arch()}`,
        cpu: os.cpus()[0]?.model || null,
        logicalCpuCount: os.cpus().length,
        node: process.version,
        npm: await commandOutput('npm', ['--version']),
        ffmpeg: (await commandOutput('ffmpeg', ['-version']))?.split('\n')[0] || null,
        gitCommit: await commandOutput('git', ['rev-parse', 'HEAD']),
        imageId: process.env.BENCHMARK_IMAGE_ID || null,
        containerRuntime: process.env.BENCHMARK_CONTAINER_RUNTIME || null,
        toggles: {
            TWIT_DEBUG: process.env.TWIT_DEBUG || null,
            TWIT_NOPROG_MS: process.env.TWIT_NOPROG_MS || null,
        },
    };
}

async function main() {
    const runs = Math.max(1, Number(process.env.BENCHMARK_RUNS || 5));
    const warmups = Math.max(0, Number(process.env.BENCHMARK_WARMUPS || 1));
    const fixture = process.env.BENCHMARK_TWITTER_FIXTURE || '1486771164475232260.json';
    const benchmarkLabel = String(process.env.BENCHMARK_LABEL || 'phase0')
        .replace(/[^a-zA-Z0-9_-]/g, '-');
    const requestedCases = new Set(String(process.env.BENCHMARK_CASES || '')
        .split(',').map(value => value.trim()).filter(Boolean));
    const artifactDir = process.env.BENCHMARK_OUTPUT_DIR || path.join(process.cwd(), 'benchmark-results');
    const corpusDir = mkdtempSync(path.join(os.tmpdir(), 'soulbot-video-phase0-corpus-'));
    const baseMetadata = loadJsonFixture(fixture);
    const sourcePath = resolveVideoFixturePath(baseMetadata.mediaURLs[0]);
    const allCases = await prepareCorpus(sourcePath, corpusDir);
    const cases = requestedCases.size > 0
        ? allCases.filter(item => requestedCases.has(item.name))
        : allCases;
    const results = [];

    if (cases.length === 0) throw new Error('No benchmark cases selected');
    mkdirSync(artifactDir, { recursive: true });

    try {
        for (const benchmarkCase of cases) {
            for (let index = 0; index < warmups + runs; index += 1) {
                const measured = index >= warmups;
                const result = await runCase({
                    benchmarkCase,
                    baseMetadata,
                    caseIndex: index + 1,
                    measured,
                    benchmarkLabel,
                });
                if (measured) results.push(result);
                console.log(JSON.stringify({
                    event: 'twitter_video_benchmark_run',
                    case: benchmarkCase.name,
                    measured,
                    status: result.status,
                    durationMs: result.durationMs,
                }));
            }
        }
    } finally {
        rmSync(corpusDir, { recursive: true, force: true });
    }

    const casesSummary = Object.fromEntries(cases.map(benchmarkCase => [
        benchmarkCase.name,
        summarizeBenchmarkRuns(results.filter(result => result.case === benchmarkCase.name)),
    ]));
    const artifact = {
        environment: await environmentMetadata(),
        configuration: { benchmarkLabel, fixture, runs, warmups, cases: cases.map(item => item.name) },
        summary: {
            overall: summarizeBenchmarkRuns(results),
            cases: casesSummary,
        },
        runs: results,
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawPath = path.join(artifactDir, `${timestamp}-${benchmarkLabel}-raw.json`);
    const summaryPath = path.join(artifactDir, `${timestamp}-${benchmarkLabel}-summary.json`);
    writeFileSync(rawPath, `${JSON.stringify(artifact, null, 2)}\n`);
    writeFileSync(summaryPath, `${JSON.stringify({
        environment: artifact.environment,
        configuration: artifact.configuration,
        summary: artifact.summary,
    }, null, 2)}\n`);
    console.log(JSON.stringify({
        event: 'twitter_video_benchmark_complete',
        rawPath,
        summaryPath,
        summary: artifact.summary,
    }));
}

main().catch(error => {
    console.error(JSON.stringify({
        event: 'twitter_video_benchmark_error',
        error: error?.message || String(error),
        stack: error?.stack || null,
    }));
    process.exitCode = 1;
});
