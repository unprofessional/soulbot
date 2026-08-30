const { existsSync, statSync } = require('node:fs');
const ffmpeg = require('fluent-ffmpeg');
const { getAdjustedAspectRatios } = require('../twitter-core/canvas_utils.js');

const probe = (filePath) => new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => error ? reject(error) : resolve(metadata));
});

function parseTimemark(timemark) {
    const [hours = 0, minutes = 0, seconds = 0] = String(timemark || '').split(':').map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
}

function outputTooLarge(outputPath, maxOutputBytes) {
    const outputBytes = existsSync(outputPath) ? statSync(outputPath).size : 0;
    if (!maxOutputBytes || outputBytes <= maxOutputBytes) return null;

    const error = new Error(`Encoded GIF exceeded upload limit: ${outputBytes} > ${maxOutputBytes} bytes`);
    error.name = 'OutputFileTooLargeError';
    error.code = 'OUTPUT_FILE_TOO_LARGE';
    error.outputBytes = outputBytes;
    error.maxOutputBytes = maxOutputBytes;
    return error;
}

async function bakeImageAsFilterIntoGif(
    mediaInputPath,
    canvasInputPath,
    gifOutputPath,
    mediaHeight,
    mediaWidth,
    canvasHeight,
    canvasWidth,
    heightShim,
    options = {},
) {
    const metadata = await probe(mediaInputPath);
    const duration = Number(metadata?.format?.duration) || 10;
    const sourceRate = metadata?.streams?.find(stream => stream.codec_type === 'video')?.avg_frame_rate;
    const [rateNumerator, rateDenominator] = String(sourceRate || '').split('/').map(Number);
    const sourceFps = rateDenominator > 0 ? rateNumerator / rateDenominator : 15;
    const fps = Math.max(1, Math.min(20, Math.round(sourceFps || 15)));
    const widthPadding = 40;
    const {
        adjustedCanvasWidth,
        adjustedCanvasHeight,
        scaledDownObjectWidth,
        scaledDownObjectHeight,
        overlayX,
        overlayY,
    } = getAdjustedAspectRatios(
        canvasWidth,
        canvasHeight,
        mediaWidth,
        mediaHeight,
        heightShim,
    );

    const filter = [
        `[0:v]scale=${adjustedCanvasWidth + widthPadding}:${adjustedCanvasHeight},fps=${fps},format=rgba[bg]`,
        `[1:v]scale=${scaledDownObjectWidth}:${scaledDownObjectHeight},fps=${fps},format=rgba[media]`,
        `[bg][media]overlay=${overlayX + widthPadding / 2}:${overlayY}:shortest=1,split[frames][palette-source]`,
        '[palette-source]palettegen=stats_mode=diff[palette]',
        '[frames][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle[outgif]',
    ].join(';');

    return new Promise((resolve, reject) => {
        const command = ffmpeg()
            .input(canvasInputPath)
            .inputOptions(['-loop', '1', '-framerate', String(fps)])
            .input(mediaInputPath)
            .complexFilter(filter)
            .outputOptions(['-map', '[outgif]', '-loop', '0', '-t', String(duration)])
            .output(gifOutputPath)
            .on('start', () => options.onSpawn?.(command.ffmpegProc))
            .on('progress', progress => {
                const currentSeconds = parseTimemark(progress.timemark);
                options.onProgress?.({
                    phase: 'encoding',
                    percent: Math.min(100, (currentSeconds / duration) * 100),
                    currentSeconds,
                    totalSeconds: duration,
                    timemark: progress.timemark,
                    outputBytes: existsSync(gifOutputPath) ? statSync(gifOutputPath).size : 0,
                    maxOutputBytes: options.maxOutputBytes || null,
                });
            })
            .on('end', () => {
                const sizeError = outputTooLarge(gifOutputPath, options.maxOutputBytes);
                if (sizeError) reject(sizeError);
                else resolve(gifOutputPath);
            })
            .on('error', reject);

        command.run();
    });
}

module.exports = { bakeImageAsFilterIntoGif };
