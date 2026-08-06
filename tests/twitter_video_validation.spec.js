const ffmpeg = require('fluent-ffmpeg');

const {
    resolveFfmpegThreads,
    validateVideoOutput,
} = require('../features/twitter-video/debug_bake_img-in-vid');

describe('Twitter video output validation', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('rejects when the final output cannot be probed', async () => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((_path, callback) => {
            callback(new Error('invalid output'));
        });

        await expect(validateVideoOutput('/tmp/invalid-output.mp4')).rejects.toThrow('invalid output');
    });

    test('rejects probeable output without a valid video stream and duration', async () => {
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((_path, callback) => {
            callback(null, { format: {}, streams: [] });
        });

        await expect(validateVideoOutput('/tmp/malformed-output.mp4'))
            .rejects.toThrow('missing video stream or duration');
    });

    test('awaits and records exactly one final validation probe', async () => {
        const metadata = {
            format: { duration: 12, size: 3456 },
            streams: [{ codec_type: 'video', codec_name: 'h264', width: 600, height: 470 }],
        };
        jest.spyOn(ffmpeg, 'ffprobe').mockImplementation((_path, callback) => {
            callback(null, metadata);
        });
        const telemetry = {
            measure: jest.fn(async (_stage, operation, details) => {
                const result = await operation();
                details(result);
                return result;
            }),
        };

        await expect(validateVideoOutput('/tmp/output.mp4', telemetry)).resolves.toBe(metadata);
        expect(telemetry.measure).toHaveBeenCalledWith(
            'output_validation_probe',
            expect.any(Function),
            expect.any(Function),
        );
        expect(ffmpeg.ffprobe).toHaveBeenCalledTimes(1);
    });
});

describe('Twitter video FFmpeg thread configuration', () => {
    test.each([
        [undefined, null],
        ['', null],
        ['1', 1],
        ['8', 8],
        ['32', 32],
        ['0', null],
        ['33', null],
        ['invalid', null],
    ])('resolves %p to %p', (value, expected) => {
        expect(resolveFfmpegThreads(value)).toBe(expected);
    });
});
