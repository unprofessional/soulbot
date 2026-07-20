const SUPPORTED_ENCODERS = new Set(['libx264', 'h264_nvenc']);

function getTwitterVideoEncoder(env = process.env) {
    const encoder = String(env.TWITTER_VIDEO_ENCODER || 'libx264').trim().toLowerCase();
    return SUPPORTED_ENCODERS.has(encoder) ? encoder : 'libx264';
}

function buildVideoEncoderOutputOptions(env = process.env) {
    const encoder = getTwitterVideoEncoder(env);

    if (encoder === 'h264_nvenc') {
        const preset = String(env.TWITTER_VIDEO_NVENC_PRESET || 'p4').trim() || 'p4';
        const cq = String(env.TWITTER_VIDEO_NVENC_CQ || '23').trim() || '23';
        const gpu = String(env.TWITTER_VIDEO_NVENC_GPU || '').trim();

        return [
            '-c:v', 'h264_nvenc',
            ...(gpu ? ['-gpu', gpu] : []),
            '-preset', preset,
            '-tune', 'hq',
            '-rc', 'vbr',
            '-cq:v', cq,
            '-b:v', '0',
            '-pix_fmt', 'yuv420p',
        ];
    }

    return [
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
    ];
}

module.exports = {
    buildVideoEncoderOutputOptions,
    getTwitterVideoEncoder,
};
