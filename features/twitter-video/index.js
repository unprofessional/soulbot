// features/twitter-video/index.js

const path = require('node:path');
const {
    createWriteStream,
    existsSync,
    mkdirSync,
} = require('node:fs');
const ffmpeg = require('fluent-ffmpeg');
const { getAdjustedAspectRatios } = require('../twitter-core/canvas_utils');

const ensureDirectoryExists = (filePath) => {
    const dirname = path.dirname(filePath);
    if (!existsSync(dirname)) {
        mkdirSync(`${dirname}/canvassed/`, { recursive: true });
    }
    return true;
};

const downloadVideo = async (remoteFileUrl, outputPath) => {
    ensureDirectoryExists(outputPath);
    const response = await fetch(remoteFileUrl);
    const fileStream = createWriteStream(outputPath);

    for await (const chunk of response.body) {
        fileStream.write(chunk);
    }
    fileStream.end();

    return new Promise((resolve, reject) => {
        fileStream.on('finish', async () => {
            try {
                const videoDuration = await getVideoDuration(outputPath);
                resolve(videoDuration <= 60);
            } catch (err) {
                reject(err);
            }
        });
        fileStream.on('error', reject);
    });
};

function extractAudioFromVideo(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(outputPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

function extractFrames(localVideoFilePath, frameRate = 10) {
    const pathParts = localVideoFilePath.split('/');
    const filenameWithExtension = pathParts.pop();
    const filename = filenameWithExtension.split('.')[0];
    const basePath = pathParts.join('/');
    const framesPathPattern = `${basePath}/${filename}_%03d.png`;

    return new Promise((resolve, reject) => {
        ffmpeg(localVideoFilePath)
            .output(framesPathPattern)
            .outputOptions([`-vf fps=${frameRate}`])
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

function recombineFramesToVideo(framesPattern, outputVideoPath, frameRate = 10) {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(framesPattern)
            .inputFPS(frameRate)
            .outputOptions(['-pix_fmt yuv420p'])
            .output(outputVideoPath)
            .size('560x?')
            .videoCodec('libx264')
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

function combineAudioWithVideo(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .output(outputPath)
            .videoCodec('copy')
            .audioCodec('aac')
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

function getVideoDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration);
        });
    });
}

function getVideoFileSize(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.size);
        });
    });
}

function bakeImageAsFilterIntoVideo(
    videoInputPath, canvasInputPath, videoOutputPath,
    videoHeight, videoWidth,
    canvasHeight, canvasWidth, heightShim
) {
    return new Promise((resolve, reject) => {
        if (!existsSync(videoInputPath)) {
            return reject(new Error(`Missing video input: ${videoInputPath}`));
        }
        if (!existsSync(canvasInputPath)) {
            return reject(new Error(`Missing canvas input: ${canvasInputPath}`));
        }

        const {
            adjustedCanvasWidth, adjustedCanvasHeight,
            scaledDownObjectWidth, scaledDownObjectHeight,
            overlayX, overlayY
        } = getAdjustedAspectRatios(
            canvasWidth, canvasHeight,
            videoWidth, videoHeight,
            heightShim
        );

        const widthPadding = 40;

        ffmpeg.ffprobe(videoInputPath, (err, metadata) => {
            if (err) return reject(new Error(`Failed to probe video: ${err.message}`));

            const hasAudio = metadata.streams.some(s => s.codec_type === 'audio');
            // Prefer stream duration; fall back to container duration.
            const fmtDur = Number(metadata.format?.duration) || 0;
            const vStream = metadata.streams.find(s => s.codec_type === 'video');
            const vDur = Number(vStream?.duration) || 0;
            const outSeconds = vDur || fmtDur || 0;

            // ---- Filter graph ----
            const vfCanvas =
        `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},` +
        `format=rgba,setpts=PTS-STARTPTS[bg]`;

            const vfVideo =
        `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},` +
        `format=yuv420p,setpts=PTS-STARTPTS[vid]`;

            // Drive output by the overlaid video; canvas loops forever, overlay stops at video end
            const vfOverlay =
        `[bg][vid]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1[outv]`;

            const filters = [vfCanvas, vfVideo, vfOverlay];

            // Audio: reset PTS, resample to a fixed rate (no async stretching)
            if (hasAudio) {
                filters.push(`[1:a]asetpts=PTS-STARTPTS,aresample=48000[aout]`);
            }

            const command = ffmpeg()
            // 0: canvas (loop to generate frames for entire duration)
                .input(canvasInputPath).inputOptions(['-loop 1'])
            // 1: source video (no genpts; let original timing stand)
                .input(videoInputPath)
                .complexFilter(filters)
                .outputOptions([
                    '-map [outv]',
                    ...(hasAudio ? ['-map [aout]'] : []),

                    // Video: no forced CFR; keep timestamps natural
                    '-c:v libx264',
                    '-preset veryfast',
                    '-crf 22',
                    '-pix_fmt yuv420p',

                    // Audio: re-encode but do NOT async-stretch
                    ...(hasAudio ? ['-c:a aac', '-b:a 128k', '-ar 48000'] : []),

                    // Container & truncation guards
                    '-shortest',
                    '-movflags +faststart'
                ])
            // Hard cap to the measured video duration to prevent tail duplication
            // (fluent-ffmpeg alias for "-t <seconds>")
                .duration(outSeconds || 0)
                .output(videoOutputPath)
                .on('start', cmd => console.log('FFmpeg command:', cmd))
                .on('end', () => resolve(videoOutputPath))
                .on('error', reject);

            command.run();
        });
    });
}

module.exports = {
    downloadVideo,
    extractAudioFromVideo,
    extractFrames,
    recombineFramesToVideo,
    combineAudioWithVideo,
    getVideoDuration,
    getVideoFileSize,
    bakeImageAsFilterIntoVideo,
};
