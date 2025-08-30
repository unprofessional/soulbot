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

        // --- 1) Pre-normalize the Twitter MP4 to get monotonic PTS/DTS ---
        const normPath = videoInputPath.replace(/\.mp4$/i, '-norm.mp4');

        const doNormalize = () =>
            new Promise((res, rej) => {
                console.log('[normalize] remux →', normPath);
                ffmpeg(videoInputPath)
                    .outputOptions([
                        // regenerate presentation timestamps
                        '-fflags', '+genpts',
                        // make negative timestamps zero
                        '-avoid_negative_ts', 'make_zero',
                        // tame huge track timescale (Twitter often uses 300000000)
                        '-video_track_timescale', '90000',
                        // mp4 friendliness
                        '-movflags', '+faststart',
                        // avoid muxer buffering for tiny files
                        '-muxpreload', '0', '-muxdelay', '0'
                    ])
                    .videoCodec('copy')
                    .audioCodec('copy')
                    .on('start', cmd => console.log('[normalize] ffmpeg start:', cmd))
                    .on('stderr', line => console.log('[normalize][stderr]', line))
                    .on('end', () => { console.log('[normalize] done'); res(); })
                    .on('error', e => { console.error('[normalize] error:', e?.message || e); rej(e); })
                    .save(normPath);
            });

        const probe = (p) =>
            new Promise((res, rej) => {
                ffmpeg.ffprobe(p, (err, meta) => err ? rej(err) : res(meta));
            });

        (async () => {
            // Always normalize (fast stream-copy) to remove CTTS/edit-list nasties
            await doNormalize();

            const meta = await probe(normPath);
            const v = meta.streams.find(s => s.codec_type === 'video');
            const a = meta.streams.find(s => s.codec_type === 'audio');
            const hasAudio = Boolean(a);

            const fmtDur = Number(meta.format?.duration) || 0;
            const vDur   = Number(v?.duration) || 0;
            const aDur   = Number(a?.duration) || 0;

            const vStart = Number(v?.start_time) || 0;
            const aStart = Number(a?.start_time) || 0;
            const delta  = vStart - aStart;

            const vR     = v?.r_frame_rate ?? null;
            const vAvgR  = v?.avg_frame_rate ?? null;
            const fpsStr = vR && parseRate(vR) ? vR : (vAvgR || '30000/1001');
            const fpsVal = parseRate(fpsStr) || 29.97;

            const vTimeBase = v?.time_base ?? null;
            const vNbFrames = (v && 'nb_frames' in v) ? Number(v.nb_frames) : null;
            const aTimeBase = a?.time_base ?? null;
            const aRate     = a?.sample_rate ?? null;
            const aCh       = (a && 'channels' in a) ? Number(a.channels) : null;

            console.log('[ffprobe:NORM] format.duration (s):', fmtDur);
            console.log('[ffprobe:NORM] video: { start_time:', vStart, ', duration:', vDur, ', time_base:', vTimeBase,
                ', r_frame_rate:', vR, `≈${parseRate(vR) || 'n/a'}`, ', avg_frame_rate:', vAvgR, `≈${parseRate(vAvgR) || 'n/a'}`, ', nb_frames:', vNbFrames, '}');
            if (hasAudio) {
                console.log('[ffprobe:NORM] audio: { start_time:', aStart, ', duration:', aDur, ', time_base:', aTimeBase,
                    ', sample_rate:', aRate, ', channels:', aCh, '}');
            } else {
                console.log('[ffprobe:NORM] audio: <none>');
            }
            console.log('[sync:NORM] delta = video_start - audio_start =', delta.toFixed(6), 'seconds');
            console.log('[clock] canvas FPS =', fpsStr, `≈${fpsVal}`);
            console.log('[canvas] dims:', { adjustedCanvasWidth, adjustedCanvasHeight, scaledDownObjectWidth, scaledDownObjectHeight, overlayX, overlayY, widthPadding });

            // ---------- 2) Overlay graph (leave PTS as-is; we normalized already) ----------
            const vfCanvas =
        `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},` +
        `fps=${fpsStr},format=rgba[bg]`;

            const vfVideo =
        `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},` +
        `format=yuv420p[vid]`;

            const vfOverlay =
        `[bg][vid]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1[outv]`;

            const filterComplex = hasAudio
                ? `${vfCanvas};${vfVideo};${vfOverlay};[1:a]aresample=48000[aout]`
                : `${vfCanvas};${vfVideo};${vfOverlay}`;

            console.log('[filters] filter_complex =', filterComplex);

            const command = ffmpeg()
            // PNG base (loop at video FPS)
                .input(canvasInputPath)
                .inputOptions(['-loop', '1', '-framerate', fpsStr])
            // NORMALIZED video second
                .input(normPath)
                .complexFilter(filterComplex)
                .outputOptions([
                    '-loglevel', 'verbose',

                    // Keep the normalized timestamps starting at zero cleanly in container
                    '-copyts', '-start_at_zero',
                    '-muxpreload', '0', '-muxdelay', '0',

                    // Mapping
                    '-map', '[outv]',
                    ...(hasAudio ? ['-map', '[aout]'] : []),

                    // Encode
                    '-c:v', 'libx264',
                    '-preset', 'veryfast',
                    '-crf', '22',
                    '-pix_fmt', 'yuv420p',
                    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000'] : []),

                    // End when shortest stream ends (video)
                    '-shortest',
                    '-movflags', '+faststart',
                ])
                .output(videoOutputPath)
                .on('start', cmd => console.log('[ffmpeg] start:', cmd))
                .on('codecData', data => console.log('[ffmpeg] codecData:', data))
                .on('progress', p => console.log('[ffmpeg] progress:', p))
                .on('stderr', line => console.log('[ffmpeg][stderr]', line))
                .on('end', () => { console.log('[ffmpeg] end OK'); resolve(videoOutputPath); })
                .on('error', e => { console.error('[ffmpeg] error:', e?.message || e); reject(e); });

            command.run();
        })().catch(reject);
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
