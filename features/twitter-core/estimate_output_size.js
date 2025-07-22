// features/twitter-core/estimate_output_size.js

const ffmpeg = require('fluent-ffmpeg');

/**
 * Estimates the final output file size based on actual input bitrate and duration.
 * Uses video + audio bitrate from ffprobe and applies a tuning fudge factor.
 *
 * @param {string} filePath - Local path to the downloaded input video.
 * @param {number} fudgeFactor - Calibration factor (default: 0.9).
 * @returns {Promise<number>} - Estimated output file size in bytes.
 */
async function estimateOutputSizeBytes(filePath, fudgeFactor = 0.9) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);

            const durationSec = metadata.format.duration || 0;
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            const videoBitrate = parseInt(videoStream?.bit_rate || 0, 10); // in bps
            const audioBitrate = parseInt(audioStream?.bit_rate || 0, 10); // in bps
            const totalBitrate = videoBitrate + audioBitrate;

            if (!durationSec || !totalBitrate) {
                return reject(new Error('Missing duration or bitrate information for estimation.'));
            }

            // Estimate raw size in bytes
            const estimatedSize = (totalBitrate / 8) * durationSec;

            // Apply fudge factor to simulate expected compression/padding
            resolve(Math.floor(estimatedSize * fudgeFactor));
        });
    });
}

module.exports = { estimateOutputSizeBytes };
