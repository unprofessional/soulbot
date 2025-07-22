// features/twitter-core/estimate_output_size.js

const ffmpeg = require('fluent-ffmpeg');

/**
 * Uses ffprobe to extract stream metadata and estimate output file size.
 * Calibrated based on actual FFmpeg output for short/long and low/high-res videos.
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

            const width = videoStream?.width || 'unknown';
            const height = videoStream?.height || 'unknown';

            const videoCodec = videoStream?.codec_name || 'unknown';
            const audioCodec = audioStream?.codec_name || 'none';
            const hasAudio = !!audioStream;

            // --- Tuned bitrate estimation logic ---
            let videoBitrateKbps;
            if (durationSec < 20) {
                videoBitrateKbps = 300;
            } else if (resolutionHeight <= 312) {
                videoBitrateKbps = 600;
            } else {
                videoBitrateKbps = 900;
            }

            const audioBitrateKbps = hasAudio ? 128 : 0;
            const totalBitrateKbps = videoBitrateKbps + audioBitrateKbps;

            const estimatedBytes = ((totalBitrateKbps * 1000) / 8) * durationSec + (150 * 1024);
            const estimatedMB = estimatedBytes / 1024 / 1024;

            // --- Logging ---
            console.log('🎥 ffprobe video:', {
                durationSec,
                resolution: `${width}x${height}`,
                videoCodec,
                videoBitrateKbps,
            });
            console.log('🔊 ffprobe audio:', {
                hasAudio,
                audioCodec,
                audioBitrateKbps,
            });
            console.log(`📏 Estimated size: ${estimatedMB.toFixed(2)}MB`);

            resolve(Math.floor(estimatedBytes));
        });
    });
}

/**
 * Utility to log ffprobe output metadata for a given video file.
 * Used for output file diagnostics.
 */
function inspectVideoFileDetails(filePath, label = 'ffprobe') {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return console.warn(`⚠️ ${label} ffprobe failed:`, err);

        const { format, streams } = metadata;
        const videoStream = streams.find((s) => s.codec_type === 'video');
        const audioStream = streams.find((s) => s.codec_type === 'audio');

        if (videoStream) {
            console.log(`🎥 ${label} video:`, {
                durationSec: parseFloat(format.duration).toFixed(2),
                resolution: `${videoStream.width}x${videoStream.height}`,
                videoCodec: videoStream.codec_name,
                videoBitrateKbps: (videoStream.bit_rate / 1000).toFixed(1),
            });
        }

        if (audioStream) {
            console.log(`🔊 ${label} audio:`, {
                hasAudio: true,
                audioCodec: audioStream.codec_name,
                audioBitrateKbps: (audioStream.bit_rate / 1000).toFixed(1),
            });
        } else {
            console.log(`🔇 ${label} audio: none`);
        }
    });
}

module.exports = {
    estimateOutputSizeBytes,
    inspectVideoFileDetails,
};
