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

        ffmpeg.ffprobe(videoInputPath, (err, meta) => {
            if (err) return reject(new Error(`Failed to probe video: ${err.message}`));

            const v = meta.streams.find(s => s.codec_type === 'video');
            const a = meta.streams.find(s => s.codec_type === 'audio');
            const hasAudio = Boolean(a);

            // Start times (seconds). If missing, treat as 0.
            const videoStart = Number(v?.start_time) || 0;
            const audioStart = Number(a?.start_time) || 0;
            const delta = videoStart - audioStart; // >0 => video starts later; <0 => audio starts later

            // Durations (seconds) for tail-trim cap
            const fmtDur = Number(meta.format?.duration) || 0;
            const vDur = Number(v?.duration) || 0;
            const aDur = Number(a?.duration) || 0;
            const outSeconds = Math.max(0, Math.min(vDur || fmtDur, aDur || fmtDur));

            // ---------- Build filter graph ----------
            // 0:v = PNG canvas (looped), 1:v/a = source video/audio
            const vfCanvas =
        `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},` +
        `format=rgba,setpts=PTS-STARTPTS[bg]`;

            // Video chain: scale → (optional delay via tpad if audio starts later) → tag
            let vfVideo =
        `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},` +
        `format=yuv420p,setpts=PTS-STARTPTS`;

            if (delta < 0) {
                // audio starts later; delay VIDEO by |delta| seconds (clone first frame)
                const padSec = Math.max(0, -delta);
                vfVideo += `,tpad=start_duration=${padSec}:start_mode=clone`;
            }
            vfVideo += `[vid]`;

            // Overlay canvas over video; overlay stops when video ends
            const vfOverlay =
        `[bg][vid]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1[outv]`;

            const filters = [vfCanvas, vfVideo, vfOverlay];

            // Audio chain: reset PTS, resample to fixed rate (no async stretch)
            if (hasAudio) {
                let af = `[1:a]asetpts=PTS-STARTPTS,aresample=48000`;
                if (delta > 0) {
                    // video starts later; delay AUDIO to match by delta ms
                    const delayMs = Math.max(0, Math.round(delta * 1000));
                    const ch = (a?.channels && Number.isFinite(a.channels)) ? a.channels : 2;
                    const perChan = Array(ch).fill(delayMs).join('|');
                    af += `,adelay=${perChan}`;
                }
                af += `[aout]`;
                filters.push(af);
            }

            // ---------- Build command ----------
            const command = ffmpeg()
            // Loop canvas so it yields frames for whole duration
                .input(canvasInputPath).inputOptions(['-loop 1'])
            // Source video as-is (we align in the filtergraph)
                .input(videoInputPath)
                .complexFilter(filters)
                .outputOptions([
                    // Explicit maps
                    '-map [outv]',
                    ...(hasAudio ? ['-map [aout]'] : []),

                    // Video encode (keep native timing; no forced CFR)
                    '-c:v libx264',
                    '-preset veryfast',
                    '-crf 22',
                    '-pix_fmt yuv420p',

                    // Audio encode (no async stretching)
                    ...(hasAudio ? ['-c:a aac', '-b:a 128k', '-ar 48000'] : []),

                    // Container niceties + end on shorter stream
                    '-shortest',
                    '-movflags +faststart',
                ])
            // Hard-cap to the shorter probed duration to avoid tail frame repeats
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
