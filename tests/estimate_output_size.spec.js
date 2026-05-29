const path = require('node:path');

const { inspectVideoFileDetails } = require('../features/twitter-core/estimate_output_size');

describe('inspectVideoFileDetails', () => {
    let logSpy;
    let warnSpy;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
    });

    test('returns video dimensions from ffprobe metadata', async () => {
        const details = await inspectVideoFileDetails(
            path.join(__dirname, 'assets/video/xK7yRU3Nrmk09DJS.mp4'),
            'fixture',
        );

        expect(details).toEqual(expect.objectContaining({
            width: 940,
            height: 534,
            videoCodec: 'h264',
            hasAudio: true,
            audioCodec: 'aac',
        }));
    });
});
