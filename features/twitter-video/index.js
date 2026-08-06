// features/twitter-video/index.js
const path = require('node:path');
const {
    createWriteStream,
    existsSync,
    mkdirSync,
    statSync,
} = require('node:fs');
const { unlink } = require('node:fs/promises');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const ffmpeg = require('fluent-ffmpeg');
const { bakeImageAsFilterIntoVideoDEBUG } = require('./debug_bake_img-in-vid');

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60000;

async function removePartialDownload(outputPath) {
    await unlink(outputPath).catch(error => {
        if (!['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error?.code)) throw error;
    });
}

/** Ensure the parent directory of a target file path exists. */
const ensureDirectoryExists = (filePath) => {
    const dirname = path.dirname(filePath);
    if (!existsSync(dirname)) {
        mkdirSync(dirname, { recursive: true });
    }
    return true;
};

/** Optional: only call this if you really want a "canvassed" subfolder created. */
const ensureCanvassedSubdir = (filePath) => {
    const canvassedDir = path.join(path.dirname(filePath), 'canvassed');
    if (!existsSync(canvassedDir)) {
        mkdirSync(canvassedDir, { recursive: true });
    }
    return canvassedDir;
};

const ffprobePromise = (p) =>
    new Promise((resolve, reject) => {
        ffmpeg.ffprobe(p, (err, md) => (err ? reject(err) : resolve(md)));
    });

/** Stream a remote file to disk. */
const downloadVideo = async (
    remoteFileUrl,
    outputPath,
    {
        telemetry,
        signal,
        timeoutMs = Number(process.env.TWIT_DOWNLOAD_TIMEOUT_MS) || DEFAULT_DOWNLOAD_TIMEOUT_MS,
    } = {}
) => {
    ensureDirectoryExists(outputPath);
    const download = async () => {
        const controller = new AbortController();
        let timedOut = false;
        let completed = false;
        let response;
        let downloadedBytes = 0;
        const onAbort = () => controller.abort(signal?.reason);
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort(new Error(`Video download timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        timeout.unref?.();

        if (signal?.aborted) onAbort();
        else signal?.addEventListener('abort', onAbort, { once: true });

        try {
            response = await fetch(remoteFileUrl, { signal: controller.signal });
            if (!response.ok || !response.body) {
                throw new Error(`downloadVideo: HTTP ${response.status} for ${remoteFileUrl}`);
            }

            const countBytes = new Transform({
                transform(chunk, _encoding, callback) {
                    downloadedBytes += chunk.length;
                    callback(null, chunk);
                },
            });

            await pipeline(
                Readable.fromWeb(response.body),
                countBytes,
                createWriteStream(outputPath),
                { signal: controller.signal },
            );
            completed = true;
            return { downloadedBytes };
        } catch (error) {
            await removePartialDownload(outputPath);

            if (timedOut) {
                const timeoutError = new Error(`Video download timed out after ${timeoutMs}ms`);
                timeoutError.name = 'VideoDownloadTimeoutError';
                timeoutError.code = 'VIDEO_DOWNLOAD_TIMEOUT';
                throw timeoutError;
            }
            throw error;
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', onAbort);
            if (response?.body && !completed) {
                await response.body.cancel(controller.signal.reason).catch(() => {});
            }
        }
    };

    const result = telemetry
        ? await telemetry.measure('download', download, ({ downloadedBytes }) => ({ downloadedBytes }))
        : await download();
    return result.downloadedBytes;
};

function extractAudioFromVideo(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .outputOptions(['-q:a 2']) // VBR quality; tweak if you like
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

function extractFrames(localVideoFilePath, frameRate = 10) {
    const base = path.parse(localVideoFilePath);
    const framesPattern = path.join(base.dir, `${base.name}_%03d.png`);

    return new Promise((resolve, reject) => {
        ffmpeg(localVideoFilePath)
            .output(framesPattern)
            .outputOptions([`-vf fps=${frameRate}`])
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

function recombineFramesToVideo(framesPattern, outputVideoPath, frameRate = 10) {
    ensureDirectoryExists(outputVideoPath);
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(framesPattern)
            .inputFPS(frameRate)
            .outputOptions([
                '-pix_fmt yuv420p',
                '-shortest',
                `-r ${frameRate}`, // explicit output fps
            ])
            .size('560x?')
            .videoCodec('libx264')
            .output(outputVideoPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

function combineAudioWithVideo(videoPath, audioPath, outputPath) {
    ensureDirectoryExists(outputPath);
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions(['-shortest'])
            .videoCodec('copy')
            .audioCodec('aac')
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

/** Safer duration helper: only probes existing files, throws helpful errors. */
async function getVideoDuration(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error(`getVideoDuration: invalid path "${filePath}"`);
    }
    if (!existsSync(filePath)) {
        throw new Error(`getVideoDuration: not found "${filePath}"`);
    }
    const md = await ffprobePromise(filePath);
    const dur = Number(md?.format?.duration);
    if (!Number.isFinite(dur)) {
        throw new Error(`getVideoDuration: duration missing for "${filePath}"`);
    }
    return dur;
}

/** Return the authoritative filesystem size without launching ffprobe. */
async function getVideoFileSize(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error(`getVideoFileSize: invalid path "${filePath}"`);
    }
    if (!existsSync(filePath)) {
        throw new Error(`getVideoFileSize: not found "${filePath}"`);
    }
    return statSync(filePath).size;
}

/** Forwarder to the debug impl you’re testing. */
async function bakeImageAsFilterIntoVideo(
    videoInputPath, canvasInputPath, videoOutputPath,
    videoHeight, videoWidth,
    canvasHeight, canvasWidth, heightShim,
    options = {}
) {
    return bakeImageAsFilterIntoVideoDEBUG(
        videoInputPath, canvasInputPath, videoOutputPath,
        videoHeight, videoWidth,
        canvasHeight, canvasWidth, heightShim,
        options
    );
}

module.exports = {
    // fs helpers
    ensureDirectoryExists,
    ensureCanvassedSubdir,

    // pipeline helpers
    downloadVideo,
    extractAudioFromVideo,
    extractFrames,
    recombineFramesToVideo,
    combineAudioWithVideo,

    // probes (robust)
    getVideoDuration,
    getVideoFileSize,

    // main
    bakeImageAsFilterIntoVideo,
};
