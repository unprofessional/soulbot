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

            const videoStart = Number(v?.start_time) || 0;
            const audioStart = Number(a?.start_time) || 0;
            const delta = videoStart - audioStart;

            const fmtDur = Number(meta.format?.duration) || 0;
            const vDur   = Number(v?.duration) || 0;
            const aDur   = Number(a?.duration) || 0;
            const outSeconds = Math.max(0, Math.min(vDur || fmtDur, aDur || fmtDur));

            const vTimeBase = v?.time_base ?? null;
            const vRFrame   = v?.r_frame_rate ?? null;
            const vAvgFrame = v?.avg_frame_rate ?? null;
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
            console.log('[output-cap] outSeconds (min(video,audio,format)) =', outSeconds);

            // ---------- Filter graph ----------
            // Input order for this fix:
            //   0 = VIDEO (base timeline)
            //   1 = PNG (overlay)
            //
            // Video chain: scale video to its display size and reset PTS to 0
            // (we use the video as the base, so its FPS/clock rule the pipeline)
            let vfVideo =
        `[0:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},` +
        `format=yuv420p,setpts=PTS-STARTPTS[base]`;

            // Canvas chain: scale and reset PTS; no looping needed.
            // overlay repeatlast=1 will keep the still image persistent.
            const vfCanvas =
        `[1:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},` +
        `format=rgba,setpts=PTS-STARTPTS[fg]`;

            // Composite: drive by base video, keep overlay alive, stop on video end
            const vfOverlay =
        `[base][fg]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1:repeatlast=1[outv]`;

            const filterParts = [vfVideo, vfCanvas, vfOverlay];

            // Audio: from the video input (0:a). Reset PTS and resample to fixed rate.
            // If there is a non-zero delta, delay whichever starts earlier (rare given your probes).
            let audioDelayMs = 0;
            if (hasAudio) {
                let af = `[0:a]asetpts=PTS-STARTPTS,aresample=48000`;
                if (delta > 0) {
                    // video starts later; delay audio to match video start
                    audioDelayMs = Math.max(0, Math.round(delta * 1000));
                    const ch = (aCh && Number.isFinite(aCh)) ? aCh : 2;
                    af += `,adelay=${Array(ch).fill(audioDelayMs).join('|')}`;
                } else if (delta < 0) {
                    // audio starts later; give video a tiny pad so their zero aligns
                    const padSec = Math.max(0, -delta);
                    // Add a tiny cloned lead on base video (will be imperceptible unless delta is large)
                    filterParts[0] =
            `[0:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},format=yuv420p,setpts=PTS-STARTPTS,` +
            `tpad=start_duration=${padSec}:start_mode=clone[base]`;
                }
                af += `[aout]`;
                filterParts.push(af);
            }

            const filterComplex = filterParts.join(';');
            console.log('[filters] filter_complex =', filterComplex);
            console.log('[decision] apply:', {
                baseIsVideo: true,
                delayAudioMs: audioDelayMs,
                delta,
                hasAudio,
            });

            const command = ffmpeg()
            // IMPORTANT: Now the **video** is input #0 (base timeline)
                .input(videoInputPath)
            // PNG overlay is input #1 — no loop, no fps tag from png_pipe
                .input(canvasInputPath)
                .complexFilter(filterComplex)
                .outputOptions([
                    '-loglevel', 'verbose',

                    // Explicit maps: video from overlay output, audio from processed 0:a
                    '-map', '[outv]',
                    ...(hasAudio ? ['-map', '[aout]'] : []),

                    // Keep native timing (don't force CFR)
                    '-c:v', 'libx264',
                    '-preset', 'veryfast',
                    '-crf', '22',
                    '-pix_fmt', 'yuv420p',

                    // Audio: fixed rate encode, no async stretching
                    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000'] : []),

                    '-shortest',
                    '-movflags', '+faststart',
                ])
            // Optional hard cap to the shorter probed duration (kept for safety)
                .duration(outSeconds || 0)
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
