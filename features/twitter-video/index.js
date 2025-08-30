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
        if (!existsSync(videoInputPath)) return reject(new Error(`Missing video input: ${videoInputPath}`));
        if (!existsSync(canvasInputPath)) return reject(new Error(`Missing canvas input: ${canvasInputPath}`));

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
            const [n, d] = r.split('/').map(Number);
            return (isFinite(n) && isFinite(d) && d) ? (n / d) : null;
        };

        const normPath = videoInputPath.replace(/\.mp4$/i, '-norm.mp4');
        const probe = (p) => new Promise((res, rej) => ffmpeg.ffprobe(p, (e, m) => e ? rej(e) : res(m)));

        const normalize = () => new Promise((res, rej) => {
            // console.log('[normalize] remux →', normPath);
            ffmpeg(videoInputPath)
                .outputOptions([
                    '-fflags', '+genpts',
                    '-avoid_negative_ts', 'make_zero',
                    '-video_track_timescale', '90000',
                    '-movflags', '+faststart',
                    '-muxpreload', '0', '-muxdelay', '0'
                ])
                .videoCodec('copy')
                .audioCodec('copy')
                // .on('start', cmd => console.log('[normalize] ffmpeg start:', cmd))
                // .on('stderr', l => console.log('[normalize][stderr]', l))
                // .on('end', () => { console.log('[normalize] done'); res(); })
                .on('error', e => { console.error('[normalize] error:', e?.message || e); rej(e); })
                .save(normPath);
        });

        (async () => {
            await normalize();

            const meta = await probe(normPath);
            const v = meta.streams.find(s => s.codec_type === 'video');
            const a = meta.streams.find(s => s.codec_type === 'audio');
            const hasAudio = !!a;

            const fmtDur = Number(meta.format?.duration) || 0;
            const vDur   = Number(v?.duration) || 0;
            const aDur   = Number(a?.duration) || 0;
            const vStart = Number(v?.start_time) || 0;
            const aStart = hasAudio ? (Number(a.start_time) || 0) : 0;
            const delta  = vStart - aStart; // >0 audio early; <0 audio late

            const vR = v?.r_frame_rate || '';
            const vAvgR = v?.avg_frame_rate || '';
            const fpsStr = (parseRate(vR) ? vR : (parseRate(vAvgR) ? vAvgR : '30000/1001'));
            const fpsVal = parseRate(fpsStr) || 29.97;
            const vNbFrames = (v && 'nb_frames' in v) ? Number(v.nb_frames) : NaN;
            const trueVDur = isFinite(vNbFrames) && vNbFrames > 0 ? (vNbFrames / fpsVal) : (vDur || fmtDur);

            // console.log('[ffprobe:NORM] format.duration (s):', fmtDur);
            // console.log('[ffprobe:NORM] video: { start_time:', vStart, ', duration:', vDur, ', nb_frames:', vNbFrames, ', r_frame_rate:', vR, ', avg_frame_rate:', vAvgR, ' }');
            // if (hasAudio) console.log('[ffprobe:NORM] audio: { start_time:', aStart, ', duration:', aDur, ' }');
            // console.log('[sync:NORM] delta = video_start - audio_start =', delta.toFixed(6), 'seconds');
            // console.log('[clock] using FPS =', fpsStr, `≈${fpsVal}`);
            // console.log('[dur] trueVDur from nb_frames/fps =', trueVDur);
            // console.log('[canvas] dims:', { adjustedCanvasWidth, adjustedCanvasHeight, scaledDownObjectWidth, scaledDownObjectHeight, overlayX, overlayY, widthPadding });

            // --- Build the filter graph ---
            // Base/background: loop PNG at video FPS, scale to canvas
            const vfCanvas = `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},fps=${fpsStr},format=rgba[bg]`;

            // Foreground: normalized video scaled to target box
            const vfVideo  = `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},format=yuv420p[vid]`;

            // Audio alignment strategy:
            //  - If delta < -0.02s, audio starts LATE → drop the gap by resetting audio PTS to 0.
            //  - If delta > +0.02s, audio starts EARLY → delay audio by delta ms.
            //  - Else, leave as-is (just resample).
            let audioChain = hasAudio ? 'aresample=48000' : '';
            if (hasAudio) {
                if (delta < -0.02) {
                    audioChain = 'asetpts=PTS-STARTPTS,aresample=48000';
                } else if (delta > +0.02) {
                    const ms = Math.round(delta * 1000);
                    audioChain = `adelay=${ms}|${ms},aresample=48000`;
                }
            }

            const vfOverlay = `[bg][vid]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1[outv]`;

            const filterComplex = hasAudio
                ? `${vfCanvas};${vfVideo};${vfOverlay};[1:a]${audioChain}[aout]`
                : `${vfCanvas};${vfVideo};${vfOverlay}`;

            // console.log('[filters] filter_complex =', filterComplex);

            // Cap output duration so we never run into tail freeze: min(true video, audio)
            const outSeconds = hasAudio ? Math.max(0, Math.min(trueVDur || fmtDur, aDur || fmtDur)) : (trueVDur || fmtDur);
            // console.log('[output-cap] -t', outSeconds);

            const cmd = ffmpeg()
            // Input 0: PNG (looped at FPS)
                .input(canvasInputPath)
                .inputOptions(['-loop', '1', '-framerate', fpsStr])
            // Input 1: normalized MP4
                .input(normPath)
                .complexFilter(filterComplex)
                .outputOptions([
                    '-loglevel', 'verbose',
                    // no -copyts here; we aligned inside filters
                    '-muxpreload', '0', '-muxdelay', '0',
                    '-map', '[outv]',
                    ...(hasAudio ? ['-map', '[aout]'] : []),
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
                    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000'] : []),
                    '-shortest',
                    '-movflags', '+faststart'
                ])
                .output(videoOutputPath)
                // .on('start', c => console.log('[ffmpeg] start:', c))
                // .on('codecData', d => console.log('[ffmpeg] codecData:', d))
                // .on('progress', p => console.log('[ffmpeg] progress:', p))
                // .on('stderr', l => console.log('[ffmpeg][stderr]', l))
                .on('end', () => { console.log('[ffmpeg] end OK'); resolve(videoOutputPath); })
                .on('error', e => { console.error('[ffmpeg] error:', e?.message || e); reject(e); });

            if (outSeconds && Number.isFinite(outSeconds)) {
                cmd.outputOptions(['-t', String(outSeconds)]);
            }

            cmd.run();
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
