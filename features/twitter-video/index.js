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

            const command = ffmpeg()
                .input(canvasInputPath)
                .input(videoInputPath)
                .complexFilter([
                    `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight}[frame]`,
                    `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight}[video]`,
                    `[frame][video]overlay=${overlayX + widthPadding / 2}:${overlayY}[out]`
                ])
                .outputOptions(['-c:v libx264', '-map [out]']);

            if (hasAudio) {
                command.outputOptions(['-map 1:a', '-c:a copy']);
            }

            command.output(videoOutputPath)
                .on('start', cmd => console.log('FFmpeg command:', cmd))
                .on('end', () => resolve(videoOutputPath))
                .on('error', err => reject(err))
                .run();
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
