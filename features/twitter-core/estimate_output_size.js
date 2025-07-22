// features/twitter-core/estimate_output_size.js

const ffmpeg = require('fluent-ffmpeg');

/**
 * Empirical CRF-style estimator for H.264 output size.
 * Adjusts for resolution and duration using a MB/s rate based on real-world tests.
 *
 * @param {string} filePath - Path to input video file.
 * @param {number} resolutionHeight - Output height (e.g. 312px).
 * @param {number} mbpsBaseline - Baseline MB/s at 360p (default: 0.3 MB/s).
 * @returns {Promise<number>} Estimated output file size in bytes.
 */
async function estimateOutputSizeBytes(filePath, resolutionHeight = 312, mbpsBaseline = 0.3) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);

            const durationSec = metadata.format.duration;
            if (!durationSec) return reject(new Error('Missing duration'));

            // Scale bitrate based on height relative to 360p
            const resolutionScale = resolutionHeight / 360;
            const estimatedMB = durationSec * mbpsBaseline * resolutionScale;

            const estimatedBytes = estimatedMB * 1024 * 1024;
            resolve(Math.floor(estimatedBytes));
        });
    });
}

module.exports = { estimateOutputSizeBytes };
