// features/twitter-core/estimate_output_size.js

const ffmpeg = require('fluent-ffmpeg');

/**
 * Uses ffprobe to extract stream metadata and estimate output file size.
 * Adds debug logging for further tuning.
 */
async function estimateOutputSizeBytes(filePath, resolutionHeight = 312) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);

            const { format, streams } = metadata;
            const durationSec = format?.duration;
            if (!durationSec) return reject(new Error('Missing duration'));

            const videoStream = streams.find((s) => s.codec_type === 'video');
            const audioStream = streams.find((s) => s.codec_type === 'audio');

            const videoBitrate = parseInt(videoStream?.bit_rate || '0', 10);
            const audioBitrate = parseInt(audioStream?.bit_rate || '0', 10);

            const width = videoStream?.width || 'unknown';
            const height = videoStream?.height || 'unknown';

            const audioCodec = audioStream?.codec_name || 'none';
            const videoCodec = videoStream?.codec_name || 'unknown';

            const hasAudio = !!audioStream;

            console.log('🎥 ffprobe video:', {
                durationSec,
                resolution: `${width}x${height}`,
                videoCodec,
                videoBitrateKbps: (videoBitrate / 1000).toFixed(1),
            });
            console.log('🔊 ffprobe audio:', {
                hasAudio,
                audioCodec,
                audioBitrateKbps: (audioBitrate / 1000).toFixed(1),
            });

            // Empirical estimate tuned for libx264 at 560px width.
            const baseMBPerSec = 0.06;
            const resolutionScale = resolutionHeight / 360;
            const fudge = 0.4; // for headers, audio, container overhead

            const estimatedMB = (durationSec * baseMBPerSec * resolutionScale) + fudge;
            const estimatedBytes = estimatedMB * 1024 * 1024;

            resolve(Math.floor(estimatedBytes));
        });
    });
}

module.exports = { estimateOutputSizeBytes };
