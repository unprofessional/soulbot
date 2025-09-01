// features/twitter-video/index.js
const path = require('node:path');
const {
    createWriteStream,
    existsSync,
    mkdirSync,
    statSync,
} = require('node:fs');
const ffmpeg = require('fluent-ffmpeg');
const { bakeImageAsFilterIntoVideoDEBUG } = require('./debug_bake_img-in-vid');

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

/** Stream a remote file to disk. Returns true if duration <= 60s after write. */
const downloadVideo = async (remoteFileUrl, outputPath) => {
    ensureDirectoryExists(outputPath);
    const response = await fetch(remoteFileUrl);
    if (!response.ok || !response.body) {
        throw new Error(`downloadVideo: HTTP ${response.status} for ${remoteFileUrl}`);
    }

    const fileStream = createWriteStream(outputPath);
    try {
        for await (const chunk of response.body) {
            fileStream.write(chunk);
        }
    } finally {
        fileStream.end();
    }

    await new Promise((resolve, reject) => {
    // use both finish & close as some streams flush async
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        const error  = (e) => { if (!done) { done = true; reject(e); } };
        fileStream.once('finish', finish);
        fileStream.once('close', finish);
        fileStream.once('error', error);
    });

    const dur = await getVideoDuration(outputPath);
    return dur <= 60;
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

/** Safer size helper: prefer filesystem size; ffprobe.format.size is often absent. */
async function getVideoFileSize(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error(`getVideoFileSize: invalid path "${filePath}"`);
    }
    if (!existsSync(filePath)) {
        throw new Error(`getVideoFileSize: not found "${filePath}"`);
    }
    // fs size is authoritative for “what we actually wrote”
    const st = statSync(filePath);
    // probe is optional info; don’t let it crash callers
    try { await ffprobePromise(filePath); } catch (_) { /* ignore */ }
    return st.size;
}

/** Forwarder to the debug impl you’re testing. */
async function bakeImageAsFilterIntoVideo(
    videoInputPath, canvasInputPath, videoOutputPath,
    videoHeight, videoWidth,
    canvasHeight, canvasWidth, heightShim
) {
    return bakeImageAsFilterIntoVideoDEBUG(
        videoInputPath, canvasInputPath, videoOutputPath,
        videoHeight, videoWidth,
        canvasHeight, canvasWidth, heightShim
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
