// features/twitter-video/debug_bake_img-in-vid.js
const crypto = require('crypto');
const fs = require('fs');
const { existsSync, statSync, createReadStream } = fs;
const ffmpeg = require('fluent-ffmpeg');
// keep your path:
const { getAdjustedAspectRatios } = require('../twitter-core/canvas_utils');

const VERBOSE = process.env.TWIT_DEBUG === '1';
const NO_PROGRESS_TIMEOUT_MS = Number(process.env.TWIT_NOPROG_MS || 30000);

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

async function debugProbe(tag, p, md) {
    const fmt = md.format || {};
    const streams = md.streams || [];
    const v = streams.find(s => s.codec_type === 'video');
    const a = streams.find(s => s.codec_type === 'audio');

    console.log(`[probe:${tag}] ${statLine(p)}`);
    console.log(`[probe:${tag}] format: dur=${seconds(Number(fmt.duration))} bit_rate=${fmt.bit_rate || 'n/a'} start_time=${fmt.start_time || 'n/a'}`);

    const logStream = (kind, s) => {
        if (!s) return console.log(`[probe:${tag}] ${kind}: none`);
        console.log(
            `[probe:${tag}] ${kind}: codec=${s.codec_name} ` +
      `w=${s.width || 'n/a'} h=${s.height || 'n/a'} ` +
      `tb=${s.time_base || 'n/a'} st=${s.start_time || 'n/a'} ` +
      `dur=${s.duration || 'n/a'} nb_frames=${s.nb_frames || 'n/a'} ` +
      `r=${s.r_frame_rate || 'n/a'} avg=${s.avg_frame_rate || 'n/a'} disp=${JSON.stringify(s.disposition || {})}`
        );
    };
    logStream('video', v);
    logStream('audio', a);

    if (VERBOSE) {
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

    console.log('[fps-pick]', {
        avg: v?.avg_frame_rate, r: v?.r_frame_rate, nb_frames: nb,
        vDur, fDur, chosen_num: fpsNum, fpsStr, vSeconds
    });

    return { fpsNum, fpsStr, vSeconds };
}

function bakeImageAsFilterIntoVideoDEBUG(
    videoInputPath, canvasInputPath, videoOutputPath,
    videoHeight, videoWidth,
    canvasHeight, canvasWidth, heightShim
) {
    return new Promise((resolve, reject) => {
        (async () => {
            if (!existsSync(videoInputPath)) throw new Error(`Missing video input: ${videoInputPath}`);
            if (!existsSync(canvasInputPath)) throw new Error(`Missing canvas input: ${canvasInputPath}`);

            console.log('[pre] inputs:');
            console.log('   ', statLine(videoInputPath));
            console.log('   ', statLine(canvasInputPath));
            const [vidSha, canSha] = await Promise.all([sha1File(videoInputPath), sha1File(canvasInputPath)]);
            console.log(`[pre] sha1 video=${vidSha} canvas=${canSha}`);

            const {
                adjustedCanvasWidth, adjustedCanvasHeight,
                scaledDownObjectWidth, scaledDownObjectHeight,
                overlayX, overlayY
            } = getAdjustedAspectRatios(
                canvasWidth, canvasHeight,
                videoWidth, videoHeight,
                heightShim
            );
            console.log('[layout]', { adjustedCanvasWidth, adjustedCanvasHeight, scaledDownObjectWidth, scaledDownObjectHeight, overlayX, overlayY });

            const widthPadding = 40;
            const normPath = videoInputPath.replace(/\.mp4$/i, '-norm.mp4');

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
                    .on('start', cmd => console.log('[normalize] ffmpeg cmd:', cmd))
                    .on('end', () => { console.log('[normalize] done', statLine(normPath)); res(); })
                    .on('stderr', line => VERBOSE && console.log('[normalize][stderr]', String(line).trim()))
                    .on('error', e => { console.error('[normalize] error:', e?.message || e); rej(e); })
                    .save(normPath);
            });

            await normalize();

            const meta = await probeAll(normPath);
            const { fmt, v, a } = await debugProbe('norm', normPath, meta);

            const hasAudio = !!a;
            const aDur   = Number(a?.duration) || NaN;
            const vStart = Number(v?.start_time) || 0;
            const aStart = hasAudio ? (Number(a.start_time) || 0) : 0;
            const delta  = vStart - aStart;

            const { fpsNum, fpsStr, vSeconds: trueVDur } = pickFpsAndDur(fmt, v);

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

            console.log('[ffmpeg] filter_complex:', filterComplex);
            console.log('[ffmpeg] fps:', fpsStr, '| audio sync delta (s):', delta.toFixed(3), '| -t:', outSeconds.toFixed(3));

            const baseOutputOpts = [
                '-loglevel', 'info', '-stats_period', '0.5',
                '-muxpreload', '0', '-muxdelay', '0',
                '-map', '[outv]',
                ...(hasAudio ? ['-map', '[aout]'] : []),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
                ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000'] : []),
                '-shortest',
                '-movflags', '+faststart',
            ];

            let lastProgTs = Date.now();
            let lastTimemark = '';
            const stderrTail = [];
            const keepTail = (line) => {
                const s = String(line);
                stderrTail.push(s);
                if (stderrTail.length > 200) stderrTail.shift();
            };

            const cmd = ffmpeg()
                .input(canvasInputPath)
                .inputOptions(['-loop', '1', '-framerate', fpsStr])
                .input(normPath)
                .complexFilter(filterComplex)
                .outputOptions(baseOutputOpts)
                .output(videoOutputPath)
                .on('start', (commandLine) => {
                    console.log('[ffmpeg] start cmd:', commandLine);
                    console.log('[ffmpeg] outputOptions:', baseOutputOpts.join(' '));
                })
                .on('codecData', d => console.log('[ffmpeg][codecData]', d))
                .on('progress', p => {
                    lastProgTs = Date.now();
                    lastTimemark = p.timemark || lastTimemark;
                    const pct = typeof p.percent === 'number' ? p.percent.toFixed(2) : 'n/a';
                    console.log(`[ffmpeg][progress] pct=${pct} frames=${p.frames ?? 'n/a'} timemark=${p.timemark ?? 'n/a'}`);
                })
                .on('stderr', line => { if (VERBOSE) console.log('[ffmpeg][stderr]', String(line).trim()); keepTail(line); })
                .on('end', async () => {
                    console.log('[ffmpeg] done', statLine(videoOutputPath));
                    try {
                        const outProbe = await probeAll(videoOutputPath);
                        await debugProbe('out', videoOutputPath, outProbe);
                    } catch (e) {
                        console.warn('[post] probe out failed:', e?.message || e);
                    }
                    resolve(videoOutputPath);
                })
                .on('error', (e, stdout, stderr) => {
                    console.error('[ffmpeg] error:', e?.message || e);
                    if (stdout) console.error('[ffmpeg] stdout(sample):', String(stdout).slice(-1500));
                    if (stderr) console.error('[ffmpeg] stderr(sample):', String(stderr).slice(-3000));
                    if (stderrTail.length) console.error('[ffmpeg] stderr(tail):\n' + stderrTail.slice(-40).join(''));
                    reject(e);
                });

            // Cap runtime + canvas frames using numeric fps
            if (Number.isFinite(outSeconds) && outSeconds > 0) {
                cmd.outputOptions(['-t', String(outSeconds)]);
                console.log('[ffmpeg] output -t:', outSeconds);
            }

            // Watchdog
            const watchdog = setInterval(() => {
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
                        clearInterval(watchdog);
                    }
                }
            }, Math.min(NO_PROGRESS_TIMEOUT_MS, 10000));

            cmd.run();
        })().catch(reject);
    });
}

module.exports = { bakeImageAsFilterIntoVideoDEBUG };
