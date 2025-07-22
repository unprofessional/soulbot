// features/twitter-core/estimate_output_size.js

const ffmpeg = require('fluent-ffmpeg');

/**
 * Uses ffprobe to estimate output video duration and returns an estimated final size in bytes.
 * @param {string} filePath - Local path to the downloaded input video.
 * @param {number} bitrateKbps - Target bitrate (default: 800kbps).
 * @returns {Promise<number>} - Estimated output file size in bytes.
 */
async function estimateOutputSizeBytes(filePath, bitrateKbps = 800) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const durationSec = metadata.format.duration;
            const bytesPerSecond = (bitrateKbps * 1000) / 8;
            const estimatedSize = Math.floor(durationSec * bytesPerSecond);
            resolve(estimatedSize);
        });
    });
}

module.exports = { estimateOutputSizeBytes };
