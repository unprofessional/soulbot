// features/twitter-core/estimate_output_size.js

const ffmpeg = require('fluent-ffmpeg');

// Target encoding rates based on observed ffmpeg output with libx264 at 560px width
const TARGET_VIDEO_BITRATE_KBPS = 850;
const TARGET_AUDIO_BITRATE_KBPS = 128;

/**
 * Estimates output file size in bytes using target bitrate assumptions.
 * Adds debug logging for tuning and diagnostics.
 * 
 * @param {string} filePath - Path to input video file.
 * @returns {Promise<number>} Estimated size in bytes.
 */
async function estimateOutputSizeBytes(filePath) {
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

            const inputVideoBitrate = parseInt(videoStream?.bit_rate || '0', 10);
            const inputAudioBitrate = parseInt(audioStream?.bit_rate || '0', 10);
            const audioCodec = audioStream?.codec_name || 'none';
            const videoCodec = videoStream?.codec_name || 'unknown';
            const hasAudio = !!audioStream;

            console.log('🎥 ffprobe video:', {
                durationSec,
                resolution: `${width}x${height}`,
                videoCodec,
                videoBitrateKbps: (inputVideoBitrate / 1000).toFixed(1),
            });
            console.log('🔊 ffprobe audio:', {
                hasAudio,
                audioCodec,
                audioBitrateKbps: (inputAudioBitrate / 1000).toFixed(1),
            });

            const totalKbps = TARGET_VIDEO_BITRATE_KBPS + (hasAudio ? TARGET_AUDIO_BITRATE_KBPS : 0);
            const estimatedBytes = ((totalKbps * 1000) / 8) * durationSec;

            // Light fudge factor for short videos (<20s)
            const fudgeBytes = durationSec < 20 ? 200 * 1024 : 0;

            const estimatedBytesWithFudge = Math.floor(estimatedBytes + fudgeBytes);
            const estimatedMB = (estimatedBytesWithFudge / 1024 / 1024).toFixed(2);

            console.log(`📏 Estimated size: ${estimatedMB}MB`);

            resolve(estimatedBytesWithFudge);
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

module.exports = { estimateOutputSizeBytes, inspectVideoFileDetails };
