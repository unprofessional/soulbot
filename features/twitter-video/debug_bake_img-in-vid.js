// features/twitter-video/debug_bake_img-in-vid.js
const crypto = require('crypto');
const fs = require('fs');
const { existsSync, statSync, createReadStream } = fs;
const ffmpeg = require('fluent-ffmpeg');
// keep your path:
const { getAdjustedAspectRatios } = require('../twitter-core/canvas_utils');
const { canUseSourceDirectly } = require('./normalization_classifier');

const VERBOSE = process.env.TWIT_DEBUG === '1';
const NO_PROGRESS_TIMEOUT_MS = Number(process.env.TWIT_NOPROG_MS || 30000);

function resolveFfmpegThreads(value = process.env.TWIT_FFMPEG_THREADS) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 32) {
        console.warn(`[ffmpeg] Invalid TWIT_FFMPEG_THREADS=${value}; using automatic threading`);
        return null;
    }
    return parsed;
}

function createOutputTooLargeError(outputPath, outputBytes, maxOutputBytes) {
    const error = new Error(
        `Encoded video exceeded upload limit: ${outputBytes} > ${maxOutputBytes} bytes`
    );
    error.name = 'OutputFileTooLargeError';
    error.code = 'OUTPUT_FILE_TOO_LARGE';
    error.outputPath = outputPath;
    error.outputBytes = outputBytes;
    error.maxOutputBytes = maxOutputBytes;
    return error;
}

function sha1File(path) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const s = createReadStream(path);
        s.on('error', reject);
        s.on('data', chunk => hash.update(chunk));
        s.on('end', () => resolve(hash.digest('hex')));
    });
}
function statLine(p) {
    try { const st = statSync(p); return `${p} size=${st.size} mtime=${st.mtime.toISOString()}`; }
    catch { return `${p} (stat failed)`; }
}
function parseRate(r) {
    if (!r || typeof r !== 'string') return null;
    const [n, d] = r.split('/').map(Number);
    return (isFinite(n) && isFinite(d) && d) ? (n / d) : null;
}
const seconds = n => Number.isFinite(n) ? n.toFixed(3) : 'NaN';
const probeAll = p => new Promise((res, rej) => ffmpeg.ffprobe(p, (e, md) => e ? rej(e) : res(md)));

function summarizeMediaMetadata(metadata) {
    const format = metadata?.format || {};
    const video = metadata?.streams?.find(stream => stream.codec_type === 'video');
    const audio = metadata?.streams?.find(stream => stream.codec_type === 'audio');
    return {
        bytes: Number(format.size) || null,
        durationSeconds: Number(format.duration) || null,
        formatStartSeconds: Number(format.start_time) || 0,
        video: video ? {
            codec: video.codec_name || null,
            width: video.width || null,
            height: video.height || null,
            averageFrameRate: video.avg_frame_rate || null,
            nominalFrameRate: video.r_frame_rate || null,
            startSeconds: Number(video.start_time) || 0,
        } : null,
        audio: audio ? {
            codec: audio.codec_name || null,
            sampleRate: Number(audio.sample_rate) || null,
            channels: audio.channels || null,
            startSeconds: Number(audio.start_time) || 0,
        } : null,
        audioVideoStartDeltaSeconds: audio && video
            ? (Number(video.start_time) || 0) - (Number(audio.start_time) || 0)
            : null,
    };
}

async function validateVideoOutput(outputPath, telemetry) {
    const probeAndValidate = async () => {
        const metadata = await probeAll(outputPath);
        const video = metadata?.streams?.find(stream => stream.codec_type === 'video');
        const duration = Number(metadata?.format?.duration);
        if (!video || !Number.isFinite(duration) || duration <= 0) {
            throw new Error('Encoded output failed validation: missing video stream or duration');
        }
        return metadata;
    };
    return telemetry
        ? telemetry.measure('output_validation_probe', probeAndValidate, summarizeMediaMetadata)
        : probeAndValidate();
}

function parseTimemarkToSeconds(timemark) {
    if (!timemark || typeof timemark !== 'string') return 0;

    const [hh = '0', mm = '0', ss = '0'] = timemark.split(':');
    const hours = Number(hh);
    const minutes = Number(mm);
    const seconds = Number(ss);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
        return 0;
    }

    return (hours * 3600) + (minutes * 60) + seconds;
}

async function debugProbe(tag, p, md) {
    const fmt = md.format || {};
    const streams = md.streams || [];
    const v = streams.find(s => s.codec_type === 'video');
    const a = streams.find(s => s.codec_type === 'audio');

    if (VERBOSE) {
        console.log(`[probe:${tag}] ${statLine(p)}`);
        console.log(`[probe:${tag}] format: dur=${seconds(Number(fmt.duration))} bit_rate=${fmt.bit_rate || 'n/a'} start_time=${fmt.start_time || 'n/a'}`);
        const logStream = (kind, stream) => {
            if (!stream) return console.log(`[probe:${tag}] ${kind}: none`);
            console.log(
                `[probe:${tag}] ${kind}: codec=${stream.codec_name} ` +
                `w=${stream.width || 'n/a'} h=${stream.height || 'n/a'} ` +
                `tb=${stream.time_base || 'n/a'} st=${stream.start_time || 'n/a'} ` +
                `dur=${stream.duration || 'n/a'} nb_frames=${stream.nb_frames || 'n/a'} ` +
                `r=${stream.r_frame_rate || 'n/a'} avg=${stream.avg_frame_rate || 'n/a'} disp=${JSON.stringify(stream.disposition || {})}`
            );
        };
        logStream('video', v);
        logStream('audio', a);
        console.log(`[probe:${tag}] json:\n${JSON.stringify({ format: fmt, streams }, null, 2)}`);
    }
    return { fmt, v, a };
}

// NEW: prefer avg_frame_rate; sanity-check r_frame_rate; derive fps number + string + video seconds
function pickFpsAndDur(fmt, v) {
    const aFps = parseRate(v?.avg_frame_rate);
    const rFps = parseRate(v?.r_frame_rate);
    const nb   = (v && 'nb_frames' in v) ? Number(v.nb_frames) : NaN;
    const vDur = Number(v?.duration) || NaN;
    const fDur = Number(fmt?.duration) || NaN;

    let fpsNum = null;
    if (aFps && aFps > 0 && aFps <= 120) fpsNum = aFps;
    else if (rFps && rFps > 0 && rFps <= 120) fpsNum = rFps;
    else if (Number.isFinite(nb) && nb > 0) {
        const dur = Number.isFinite(vDur) && vDur > 0 ? vDur
            : Number.isFinite(fDur) && fDur > 0 ? fDur
                : NaN;
        if (Number.isFinite(dur) && dur > 0) fpsNum = Math.min(120, Math.max(1, nb / dur));
    }
    if (!fpsNum) fpsNum = 30;

    const vSeconds = Number.isFinite(vDur) && vDur > 0 ? vDur
        : Number.isFinite(fDur) && fDur > 0 ? fDur
            : (Number.isFinite(nb) && nb > 0 ? nb / fpsNum : 0);

    const fpsStr = (aFps && aFps > 0 && aFps <= 120) ? (v.avg_frame_rate)
        : (rFps && rFps > 0 && rFps <= 120) ? (v.r_frame_rate)
            : String(fpsNum);

    if (VERBOSE) {
        console.log('[fps-pick]', {
            avg: v?.avg_frame_rate, r: v?.r_frame_rate, nb_frames: nb,
            vDur, fDur, chosen_num: fpsNum, fpsStr, vSeconds
        });
    }

    return { fpsNum, fpsStr, vSeconds };
}

function bakeImageAsFilterIntoVideoDEBUG(
    videoInputPath, canvasInputPath, videoOutputPath,
    videoHeight, videoWidth,
    canvasHeight, canvasWidth, heightShim
    , options = {}
) {
    return new Promise((resolve, reject) => {
        let cleanupWatchdog = () => {};

        (async () => {
            const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
            const telemetry = options?.telemetry || null;
            const maxOutputBytes = Number(options?.maxOutputBytes) || 0;
            const ffmpegThreads = resolveFfmpegThreads(options?.ffmpegThreads);
            if (!existsSync(videoInputPath)) throw new Error(`Missing video input: ${videoInputPath}`);
            if (!existsSync(canvasInputPath)) throw new Error(`Missing canvas input: ${canvasInputPath}`);

            if (VERBOSE) {
                console.log('[pre] inputs:');
                console.log('   ', statLine(videoInputPath));
                console.log('   ', statLine(canvasInputPath));
                const hashInputs = () => Promise.all([sha1File(videoInputPath), sha1File(canvasInputPath)]);
                const [vidSha, canSha] = telemetry
                    ? await telemetry.measure('input_hashing', hashInputs, {
                        videoBytes: statSync(videoInputPath).size,
                        canvasBytes: statSync(canvasInputPath).size,
                    })
                    : await hashInputs();
                console.log(`[pre] sha1 video=${vidSha} canvas=${canSha}`);
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
            if (VERBOSE) console.log('[layout]', { adjustedCanvasWidth, adjustedCanvasHeight, scaledDownObjectWidth, scaledDownObjectHeight, overlayX, overlayY });

            const widthPadding = 40;
            const normPath = videoInputPath.replace(/\.mp4$/i, '-norm.mp4');

            const probeSourceInput = () => probeAll(videoInputPath);
            let sourceMetadata = null;
            try {
                sourceMetadata = telemetry
                    ? await telemetry.measure(
                        'source_input_probe',
                        probeSourceInput,
                        summarizeMediaMetadata,
                    )
                    : await probeSourceInput();
            } catch (error) {
                console.warn('[probe:source] failed; retaining normalization path:', error?.message || error);
            }
            const forceNormalization = process.env.TWIT_FORCE_NORMALIZATION === '1' ||
                options?.forceNormalization === true;
            const normalizationDecision = forceNormalization
                ? { normalize: true, reason: 'forced_by_configuration' }
                : sourceMetadata
                    ? canUseSourceDirectly(sourceMetadata)
                    : { normalize: true, reason: 'source_probe_failed' };
            telemetry?.recordStage('normalization_decision', 0, 'ok', {
                path: normalizationDecision.normalize ? 'normalized' : 'direct',
                reason: normalizationDecision.reason,
            });
            console.log(
                `[normalization] path=${normalizationDecision.normalize ? 'normalized' : 'direct'} ` +
                `reason=${normalizationDecision.reason}`
            );

            const normalize = () => new Promise((res, rej) => {
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
                    .on('start', cmd => VERBOSE && console.log('[normalize] ffmpeg cmd:', cmd))
                    .on('end', () => { if (VERBOSE) console.log('[normalize] done', statLine(normPath)); res(); })
                    .on('stderr', line => VERBOSE && console.log('[normalize][stderr]', String(line).trim()))
                    .on('error', e => { console.error('[normalize] error:', e?.message || e); rej(e); })
                    .save(normPath);
            });

            let mediaInputPath = videoInputPath;
            let mediaMetadata = sourceMetadata;
            let probeTag = 'source';
            if (normalizationDecision.normalize) {
                if (telemetry) await telemetry.measure('normalization_remux', normalize);
                else await normalize();

                const probeNormalizedInput = () => probeAll(normPath);
                mediaMetadata = telemetry
                    ? await telemetry.measure(
                        'normalized_input_probe',
                        probeNormalizedInput,
                        summarizeMediaMetadata,
                    )
                    : await probeNormalizedInput();
                mediaInputPath = normPath;
                probeTag = 'norm';
            }
            const { fmt, v, a } = await debugProbe(probeTag, mediaInputPath, mediaMetadata);

            const hasAudio = !!a;
            const aDur   = Number(a?.duration) || NaN;
            const vStart = Number(v?.start_time) || 0;
            const aStart = hasAudio ? (Number(a.start_time) || 0) : 0;
            const delta  = vStart - aStart;

            const { fpsStr, vSeconds: trueVDur } = pickFpsAndDur(fmt, v);

            const vfCanvas = `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},fps=${fpsStr},format=rgba[bg]`;
            const vfVideo  = `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},format=yuv420p[vid]`;
            let audioChain = hasAudio ? 'aresample=48000' : '';
            if (hasAudio) {
                if (delta < -0.02) audioChain = 'asetpts=PTS-STARTPTS,aresample=48000';
                else if (delta > +0.02) {
                    const ms = Math.round(delta * 1000);
                    audioChain = `adelay=${ms}|${ms},aresample=48000`;
                }
            }
            const vfOverlay = `[bg][vid]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1[outv]`;
            const filterComplex = hasAudio
                ? `${vfCanvas};${vfVideo};${vfOverlay};[1:a]${audioChain}[aout]`
                : `${vfCanvas};${vfVideo};${vfOverlay}`;

            let outSeconds = hasAudio
                ? Math.max(0, Math.min(trueVDur || Infinity, aDur || Infinity))
                : (trueVDur || 0);
            if (!Number.isFinite(outSeconds) || outSeconds <= 0) {
                console.warn('[warn] computed outSeconds invalid; fallback to trueVDur or 10s');
                outSeconds = (Number.isFinite(trueVDur) && trueVDur > 0) ? trueVDur : 10;
            }

            if (VERBOSE) {
                console.log('[ffmpeg] filter_complex:', filterComplex);
                console.log('[ffmpeg] fps:', fpsStr, '| audio sync delta (s):', delta.toFixed(3), '| -t:', outSeconds.toFixed(3));
            }

            if (onProgress) {
                Promise.resolve(onProgress({
                    phase: 'encoding',
                    percent: 0,
                    currentSeconds: 0,
                    totalSeconds: outSeconds,
                    timemark: '00:00:00.00',
                })).catch(error => {
                    console.warn('[ffmpeg] onProgress(start) failed:', error);
                });
            }

            const baseOutputOpts = [
                '-loglevel', 'info', '-stats',
                '-muxpreload', '0', '-muxdelay', '0',
                '-map', '[outv]',
                ...(hasAudio ? ['-map', '[aout]'] : []),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
                ...(ffmpegThreads ? ['-threads', String(ffmpegThreads)] : []),
                ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000'] : []),
                '-shortest',
                '-movflags', '+faststart',
            ];
            telemetry?.recordStage('encoder_configuration', 0, 'ok', {
                threads: ffmpegThreads || 'auto',
            });

            let lastProgTs = Date.now();
            let lastTimemark = '';
            let lastOutputBytes = 0;
            let abortError = null;
            let encodeStartedAt = null;
            const stderrTail = [];
            const keepTail = (line) => {
                const s = String(line);
                stderrTail.push(s);
                if (stderrTail.length > 200) stderrTail.shift();
            };

            const readOutputBytes = () => {
                try {
                    lastOutputBytes = existsSync(videoOutputPath) ? statSync(videoOutputPath).size : 0;
                } catch (_) {
                    lastOutputBytes = 0;
                }
                return lastOutputBytes;
            };

            const abortIfOutputTooLarge = () => {
                if (!maxOutputBytes || abortError) return false;

                const outputBytes = readOutputBytes();
                if (outputBytes <= maxOutputBytes) return false;

                abortError = createOutputTooLargeError(videoOutputPath, outputBytes, maxOutputBytes);
                console.warn(`[ffmpeg] output exceeded limit; killing encode: ${outputBytes} > ${maxOutputBytes}`);

                try {
                    if (cmd && cmd.ffmpegProc && cmd.ffmpegProc.pid) {
                        cmd.ffmpegProc.kill('SIGKILL');
                    }
                } catch (e) {
                    console.warn('[ffmpeg] output limit kill failed:', e?.message || e);
                }

                return true;
            };

            let watchdog;
            cleanupWatchdog = () => {
                if (watchdog) {
                    clearInterval(watchdog);
                    watchdog = null;
                }
            };

            const cmd = ffmpeg()
                .input(canvasInputPath)
                .inputOptions(['-loop', '1', '-framerate', fpsStr])
                .input(mediaInputPath)
                .complexFilter(filterComplex)
                .outputOptions(baseOutputOpts)
                .output(videoOutputPath)
                .on('start', (commandLine) => {
                    encodeStartedAt = Date.now();
                    console.log('[ffmpeg] encode started');
                    if (VERBOSE) {
                        console.log('[ffmpeg] start cmd:', commandLine);
                        console.log('[ffmpeg] outputOptions:', baseOutputOpts.join(' '));
                    }
                    const proc = cmd.ffmpegProc;
                    if (proc && typeof options?.onSpawn === 'function') {
                        options.onSpawn(proc);
                    }
                })
                .on('codecData', d => VERBOSE && console.log('[ffmpeg][codecData]', d))
                .on('progress', p => {
                    lastProgTs = Date.now();
                    lastTimemark = p.timemark || lastTimemark;
                    const currentSeconds = parseTimemarkToSeconds(lastTimemark);
                    const outputBytes = readOutputBytes();
                    const pctNum = outSeconds > 0
                        ? Math.max(0, Math.min(100, (currentSeconds / outSeconds) * 100))
                        : 0;
                    const pct = pctNum.toFixed(2);
                    if (VERBOSE) console.log(`[ffmpeg][progress] pct=${pct} frames=${p.frames ?? 'n/a'} timemark=${p.timemark ?? 'n/a'} outputBytes=${outputBytes}`);

                    if (onProgress) {
                        Promise.resolve(onProgress({
                            phase: 'encoding',
                            percent: pctNum,
                            currentSeconds,
                            totalSeconds: outSeconds,
                            timemark: lastTimemark,
                            frames: p.frames ?? null,
                            outputBytes,
                            maxOutputBytes: maxOutputBytes || null,
                        })).catch(error => {
                            console.warn('[ffmpeg] onProgress(progress) failed:', error);
                        });
                    }

                    abortIfOutputTooLarge();
                })
                .on('stderr', line => { if (VERBOSE) console.log('[ffmpeg][stderr]', String(line).trim()); keepTail(line); })
                .on('end', async () => {
                    cleanupWatchdog();
                    if (telemetry && encodeStartedAt) {
                        telemetry.recordStage('composite_encode', Date.now() - encodeStartedAt);
                    }
                    if (onProgress) {
                        Promise.resolve(onProgress({
                            phase: 'encoding',
                            percent: 100,
                            currentSeconds: outSeconds,
                            totalSeconds: outSeconds,
                            timemark: lastTimemark || '00:00:00.00',
                        })).catch(error => {
                            console.warn('[ffmpeg] onProgress(end) failed:', error);
                        });
                    }
                    console.log('[ffmpeg] encode completed');
                    try {
                        const outProbe = await validateVideoOutput(videoOutputPath, telemetry);
                        await debugProbe('out', videoOutputPath, outProbe);
                    } catch (e) {
                        console.error('[post] output validation failed:', e?.message || e);
                        reject(e);
                        return;
                    }
                    resolve(videoOutputPath);
                })
                .on('error', (e, stdout, stderr) => {
                    cleanupWatchdog();
                    if (telemetry && encodeStartedAt) {
                        telemetry.recordStage('composite_encode', Date.now() - encodeStartedAt, 'failed');
                    }
                    const error = abortError || e;
                    console.error('[ffmpeg] error:', error?.message || error);
                    if (stdout) console.error('[ffmpeg] stdout(sample):', String(stdout).slice(-1500));
                    if (stderr) console.error('[ffmpeg] stderr(sample):', String(stderr).slice(-3000));
                    if (stderrTail.length) console.error('[ffmpeg] stderr(tail):\n' + stderrTail.slice(-40).join(''));
                    reject(error);
                });

            // Cap runtime + canvas frames using numeric fps
            if (Number.isFinite(outSeconds) && outSeconds > 0) {
                cmd.outputOptions(['-t', String(outSeconds)]);
                if (VERBOSE) console.log('[ffmpeg] output -t:', outSeconds);
            }

            // Watchdog
            watchdog = setInterval(() => {
                if (abortIfOutputTooLarge()) return;

                const since = Date.now() - lastProgTs;
                if (since > NO_PROGRESS_TIMEOUT_MS) {
                    console.error(`[watchdog] no progress for ${since}ms (> ${NO_PROGRESS_TIMEOUT_MS}). lastTimemark=${lastTimemark || 'n/a'}`);
                    try {
                        if (cmd && cmd.ffmpegProc && cmd.ffmpegProc.pid) {
                            console.error(`[watchdog] killing pid=${cmd.ffmpegProc.pid}`);
                            cmd.ffmpegProc.kill('SIGKILL');
                        } else {
                            console.error('[watchdog] cannot find ffmpegProc; SIGKILL may not be possible.');
                        }
                    } catch (e) {
                        console.error('[watchdog] kill error:', e?.message || e);
                    } finally {
                        cleanupWatchdog();
                    }
                }
            }, Math.min(NO_PROGRESS_TIMEOUT_MS, 10000));
            watchdog.unref?.();

            cmd.run();
        })().catch(err => {
            cleanupWatchdog();
            reject(err);
        });
    });
}

module.exports = {
    bakeImageAsFilterIntoVideoDEBUG,
    resolveFfmpegThreads,
    validateVideoOutput,
};
