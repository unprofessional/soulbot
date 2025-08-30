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

        const parseRate = (r) => {
            if (!r || typeof r !== 'string') return null;
            const [num, den] = r.split('/').map(Number);
            if (!isFinite(num) || !isFinite(den) || den === 0) return null;
            return num / den;
        };

        ffmpeg.ffprobe(videoInputPath, (err, meta) => {
            if (err) return reject(new Error(`Failed to probe video: ${err.message}`));

            const v = meta.streams.find(s => s.codec_type === 'video');
            const a = meta.streams.find(s => s.codec_type === 'audio');
            const hasAudio = Boolean(a);

            // --- Probe facts ---
            const videoStart = Number(v?.start_time) || 0;
            const audioStart = Number(a?.start_time) || 0;
            const delta = videoStart - audioStart;

            const fmtDur = Number(meta.format?.duration) || 0;
            const vDur   = Number(v?.duration) || 0;
            const aDur   = Number(a?.duration) || 0;

            // Use the native FPS from r_frame_rate; fallback to avg or 30000/1001
            const vRFrame   = v?.r_frame_rate ?? null;
            const vAvgFrame = v?.avg_frame_rate ?? null;
            const fpsStr = vRFrame && parseRate(vRFrame) ? vRFrame : (vAvgFrame || '30000/1001');
            const fpsVal = parseRate(fpsStr) || 29.97;

            const vTimeBase = v?.time_base ?? null;
            const vNbFrames = (v && 'nb_frames' in v) ? Number(v.nb_frames) : null;
            const aTimeBase = a?.time_base ?? null;
            const aRate     = a?.sample_rate ?? null;
            const aCh       = (a && 'channels' in a) ? Number(a.channels) : null;

            console.log('[ffprobe] format.duration (s):', fmtDur);
            console.log('[ffprobe] video: { start_time:', videoStart, ', duration:', vDur, ', time_base:', vTimeBase,
                ', r_frame_rate:', vRFrame, `≈${parseRate(vRFrame) || 'n/a'}`, ', avg_frame_rate:', vAvgFrame, `≈${parseRate(vAvgFrame) || 'n/a'}`, ', nb_frames:', vNbFrames, '}');
            if (hasAudio) {
                console.log('[ffprobe] audio: { start_time:', audioStart, ', duration:', aDur, ', time_base:', aTimeBase,
                    ', sample_rate:', aRate, ', channels:', aCh, '}');
            } else {
                console.log('[ffprobe] audio: <none>');
            }
            console.log('[sync] delta = video_start - audio_start =', delta.toFixed(6), 'seconds');
            console.log('[canvas] dims:', { adjustedCanvasWidth, adjustedCanvasHeight, scaledDownObjectWidth, scaledDownObjectHeight, overlayX, overlayY, widthPadding });
            console.log('[clock] canvas FPS =', fpsStr, `≈${fpsVal}`);

            // ---------- Filter graph (NO setpts on video/audio) ----------
            // 0:v = PNG canvas (looped), 1:v/a = source video/audio

            // Canvas: scale to full output, force FPS to match the video (so it doesn't impose 25fps)
            const vfCanvas =
        `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},` +
        `fps=${fpsStr},format=rgba[bg]`;

            // Video: scale down to its slot; DO NOT touch PTS here
            const vfVideo =
        `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},` +
        `format=yuv420p[vid]`;

            // Composite: base = canvas, stop when video ends
            const vfOverlay =
        `[bg][vid]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1[outv]`;

            const filterParts = [vfCanvas, vfVideo, vfOverlay];

            // Audio: from input 1 (the video), keep PTS; just resample to a sane rate
            if (hasAudio) {
                const af = `[1:a]aresample=48000[aout]`;
                filterParts.push(af);
            }

            const filterComplex = filterParts.join(';');
            console.log('[filters] filter_complex =', filterComplex);

            const command = ffmpeg()
            // PNG FIRST as base; loop it and set input framerate to match video
                .input(canvasInputPath)
                .inputOptions(['-loop', '1', '-framerate', fpsStr])
            // Video second (native timestamps preserved)
                .input(videoInputPath)
                .complexFilter(filterComplex)
                .outputOptions([
                    '-loglevel', 'verbose',

                    // Preserve input timestamps, but make the output start at zero
                    '-copyts', '-start_at_zero',
                    // Avoid muxer buffering delays:
                    '-muxpreload', '0', '-muxdelay', '0',

                    // Explicit maps
                    '-map', '[outv]',
                    ...(hasAudio ? ['-map', '[aout]'] : []),

                    // Video encode (do not force CFR)
                    '-c:v', 'libx264',
                    '-preset', 'veryfast',
                    '-crf', '22',
                    '-pix_fmt', 'yuv420p',

                    // Audio encode (no async stretch)
                    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000'] : []),

                    '-shortest',
                    '-movflags', '+faststart',
                ])
            // IMPORTANT: don't force a -t cap here; let native PTS decide
                .output(videoOutputPath)
                .on('start', cmd => console.log('[ffmpeg] start:', cmd))
                .on('codecData', data => console.log('[ffmpeg] codecData:', data))
                .on('progress', p => console.log('[ffmpeg] progress:', p))
                .on('stderr', line => console.log('[ffmpeg][stderr]', line))
                .on('end', () => {
                    console.log('[ffmpeg] end OK');
                    resolve(videoOutputPath);
                })
                .on('error', e => {
                    console.error('[ffmpeg] error:', e?.message || e);
                    reject(e);
                });

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
