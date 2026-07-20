const {
    buildVideoEncoderOutputOptions,
    getTwitterVideoEncoder,
} = require('../features/twitter-video/encoder_options.js');

describe('twitter video encoder options', () => {
    test('defaults to the existing libx264 settings', () => {
        expect(getTwitterVideoEncoder({})).toBe('libx264');
        expect(buildVideoEncoderOutputOptions({})).toEqual([
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '22',
            '-pix_fmt', 'yuv420p',
        ]);
    });

    test('builds h264_nvenc options with benchmark overrides', () => {
        expect(getTwitterVideoEncoder({
            TWITTER_VIDEO_ENCODER: 'h264_nvenc',
        })).toBe('h264_nvenc');

        expect(buildVideoEncoderOutputOptions({
            TWITTER_VIDEO_ENCODER: 'h264_nvenc',
            TWITTER_VIDEO_NVENC_GPU: '1',
            TWITTER_VIDEO_NVENC_PRESET: 'p5',
            TWITTER_VIDEO_NVENC_CQ: '24',
        })).toEqual([
            '-c:v', 'h264_nvenc',
            '-gpu', '1',
            '-preset', 'p5',
            '-tune', 'hq',
            '-rc', 'vbr',
            '-cq:v', '24',
            '-b:v', '0',
            '-pix_fmt', 'yuv420p',
        ]);
    });

    test('falls back to libx264 for unknown encoders', () => {
        expect(getTwitterVideoEncoder({
            TWITTER_VIDEO_ENCODER: 'mystery_encoder',
        })).toBe('libx264');
    });
});
