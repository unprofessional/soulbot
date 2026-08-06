const {
    canUseSourceDirectly,
    parseRate,
    parseTimeBase,
} = require('../features/twitter-video/normalization_classifier.js');

function safeMetadata() {
    return {
        format: {
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
            duration: '12.5',
            start_time: '0.000000',
        },
        streams: [
            {
                codec_type: 'video',
                codec_name: 'h264',
                width: 1280,
                height: 720,
                time_base: '1/90000',
                avg_frame_rate: '30/1',
                r_frame_rate: '30/1',
                duration: '12.5',
                start_time: '0.000000',
            },
            {
                codec_type: 'audio',
                codec_name: 'aac',
                time_base: '1/48000',
                duration: '12.5',
                start_time: '0.000000',
            },
        ],
    };
}

describe('Twitter video normalization classifier', () => {
    test('allows a simple constant-frame-rate H.264/AAC MP4', () => {
        expect(canUseSourceDirectly(safeMetadata())).toEqual(expect.objectContaining({
            normalize: false,
            reason: 'safe_mp4_h264_aac_timestamps',
            hasAudio: true,
        }));
    });

    test('allows a safe silent MP4', () => {
        const metadata = safeMetadata();
        metadata.streams.pop();
        expect(canUseSourceDirectly(metadata)).toEqual(expect.objectContaining({
            normalize: false,
            hasAudio: false,
        }));
    });

    test.each([
        ['variable frame rate', metadata => { metadata.streams[0].avg_frame_rate = '2997/100'; }, 'variable_frame_rate'],
        ['negative timestamp', metadata => { metadata.streams[0].start_time = '-0.1'; }, 'negative_start_timestamp'],
        ['nonzero timestamp', metadata => { metadata.format.start_time = '0.25'; }, 'nonzero_start_timestamp'],
        ['audio offset', metadata => { metadata.streams[1].start_time = '0.25'; }, 'audio_video_start_delta'],
        ['unusual time base', metadata => { metadata.streams[0].time_base = '1/1000001'; }, 'invalid_video_time_base'],
        ['missing duration', metadata => {
            delete metadata.format.duration;
            delete metadata.streams[0].duration;
        }, 'invalid_duration'],
        ['non-H.264 video', metadata => { metadata.streams[0].codec_name = 'vp9'; }, 'unsupported_video_codec'],
        ['non-AAC audio', metadata => { metadata.streams[1].codec_name = 'opus'; }, 'unsupported_audio_codec'],
        ['non-MP4 container', metadata => { metadata.format.format_name = 'matroska,webm'; }, 'unsupported_container'],
        ['missing start timestamp', metadata => { delete metadata.streams[0].start_time; }, 'invalid_start_timestamp'],
    ])('normalizes %s inputs', (_label, mutate, reason) => {
        const metadata = safeMetadata();
        mutate(metadata);
        expect(canUseSourceDirectly(metadata)).toEqual({ normalize: true, reason });
    });

    test('normalizes malformed and ambiguous probe data', () => {
        expect(canUseSourceDirectly(null)).toEqual({ normalize: true, reason: 'video_stream_count' });
        const metadata = safeMetadata();
        metadata.streams.push({ ...metadata.streams[0] });
        expect(canUseSourceDirectly(metadata)).toEqual({ normalize: true, reason: 'video_stream_count' });
    });

    test('strictly parses rates and time bases', () => {
        expect(parseRate('30000/1001')).toBeCloseTo(29.97);
        expect(parseRate('0/0')).toBeNull();
        expect(parseTimeBase('1/90000')).toBeCloseTo(1 / 90000);
        expect(parseTimeBase('1/0')).toBeNull();
    });
});
