// features/twitter-core/estimate_output_size.js

const ffmpeg = require('fluent-ffmpeg');

/**
 * CRF-style empirical estimator with fudge factor for short clips.
 *
 * @param {string} filePath - Input video.
 * @param {number} resolutionHeight - Height of output canvas video.
 * @returns {Promise<number>} Estimated output file size in bytes.
 */
async function estimateOutputSizeBytes(filePath, resolutionHeight = 312) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);

            const durationSec = metadata.format.duration;
            if (!durationSec) return reject(new Error('Missing duration'));

            const baselineMBPerSecAt360p = 0.06;
            const resolutionScale = resolutionHeight / 360;

            const estimatedMB = (durationSec * baselineMBPerSecAt360p * resolutionScale) + 0.4;
            const estimatedBytes = estimatedMB * 1024 * 1024;

            resolve(Math.floor(estimatedBytes));
        });
    });
}

module.exports = { estimateOutputSizeBytes };
