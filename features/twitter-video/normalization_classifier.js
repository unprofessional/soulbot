const MAX_START_OFFSET_SECONDS = 0.02;
const MAX_AV_DELTA_SECONDS = 0.02;
const MAX_SUPPORTED_FPS = 120;

function parseRate(value) {
    if (!value || typeof value !== 'string') return null;
    const [numerator, denominator] = value.split('/').map(Number);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
        return null;
    }
    const rate = numerator / denominator;
    return rate > 0 ? rate : null;
}

function parseTimeBase(value) {
    if (!value || typeof value !== 'string') return null;
    const [numerator, denominator] = value.split('/').map(Number);
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) return null;
    if (numerator !== 1 || denominator <= 0 || denominator > 1000000) return null;
    return numerator / denominator;
}

function normalizeStart(value) {
    if (value === undefined || value === null || value === 'N/A') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDuration(stream, format) {
    const streamDuration = Number(stream?.duration);
    if (Number.isFinite(streamDuration) && streamDuration > 0) return streamDuration;
    const formatDuration = Number(format?.duration);
    return Number.isFinite(formatDuration) && formatDuration > 0 ? formatDuration : null;
}

function requiresNormalization(reason, details = {}) {
    return { normalize: true, reason, ...details };
}

function canUseSourceDirectly(metadata) {
    const format = metadata?.format || {};
    const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
    const videoStreams = streams.filter(stream => stream?.codec_type === 'video');
    const audioStreams = streams.filter(stream => stream?.codec_type === 'audio');

    if (videoStreams.length !== 1) return requiresNormalization('video_stream_count');
    if (audioStreams.length > 1) return requiresNormalization('audio_stream_count');

    const video = videoStreams[0];
    const audio = audioStreams[0] || null;
    const formatNames = String(format.format_name || '').split(',').map(name => name.trim());
    if (!formatNames.some(name => ['mov', 'mp4'].includes(name))) {
        return requiresNormalization('unsupported_container');
    }
    if (video.codec_name !== 'h264') return requiresNormalization('unsupported_video_codec');
    if (audio && audio.codec_name !== 'aac') return requiresNormalization('unsupported_audio_codec');

    const duration = normalizeDuration(video, format);
    if (!duration) return requiresNormalization('invalid_duration');
    if (!Number.isFinite(Number(video.width)) || Number(video.width) <= 0 ||
        !Number.isFinite(Number(video.height)) || Number(video.height) <= 0) {
        return requiresNormalization('invalid_dimensions');
    }
    if (!parseTimeBase(video.time_base)) return requiresNormalization('invalid_video_time_base');
    if (audio && !parseTimeBase(audio.time_base)) {
        return requiresNormalization('invalid_audio_time_base');
    }

    const averageFps = parseRate(video.avg_frame_rate);
    const nominalFps = parseRate(video.r_frame_rate);
    if (!averageFps || !nominalFps || averageFps > MAX_SUPPORTED_FPS || nominalFps > MAX_SUPPORTED_FPS) {
        return requiresNormalization('invalid_frame_rate');
    }
    const frameRateDelta = Math.abs(averageFps - nominalFps) / nominalFps;
    if (frameRateDelta > 0.001) return requiresNormalization('variable_frame_rate');

    const formatStart = normalizeStart(format.start_time);
    const videoStart = normalizeStart(video.start_time);
    const audioStart = audio ? normalizeStart(audio.start_time) : 0;
    if (formatStart === null || videoStart === null || audioStart === null) {
        return requiresNormalization('invalid_start_timestamp');
    }
    if (formatStart < 0 || videoStart < 0 || audioStart < 0) {
        return requiresNormalization('negative_start_timestamp');
    }
    const audioVideoStartDeltaSeconds = audio ? videoStart - audioStart : null;
    if (audio && Math.abs(audioVideoStartDeltaSeconds) > MAX_AV_DELTA_SECONDS) {
        return requiresNormalization('audio_video_start_delta');
    }
    if (Math.abs(formatStart) > MAX_START_OFFSET_SECONDS ||
        Math.abs(videoStart) > MAX_START_OFFSET_SECONDS ||
        Math.abs(audioStart) > MAX_START_OFFSET_SECONDS) {
        return requiresNormalization('nonzero_start_timestamp');
    }

    return {
        normalize: false,
        reason: 'safe_mp4_h264_aac_timestamps',
        hasAudio: Boolean(audio),
        durationSeconds: duration,
        averageFrameRate: video.avg_frame_rate,
        audioVideoStartDeltaSeconds,
    };
}

module.exports = {
    canUseSourceDirectly,
    parseRate,
    parseTimeBase,
};
