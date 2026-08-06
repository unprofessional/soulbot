const path = require('node:path');
const { statSync } = require('node:fs');
const ffmpeg = require('fluent-ffmpeg');

const { inspectVideoFileDetails } = require('../features/twitter-core/estimate_output_size');
const { getVideoFileSize } = require('../features/twitter-video');

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

describe('getVideoFileSize', () => {
    test('uses filesystem stat without launching ffprobe', async () => {
        const fixturePath = path.join(__dirname, 'assets/video/xK7yRU3Nrmk09DJS.mp4');
        const ffprobeSpy = jest.spyOn(ffmpeg, 'ffprobe');

        await expect(getVideoFileSize(fixturePath)).resolves.toBe(statSync(fixturePath).size);
        expect(ffprobeSpy).not.toHaveBeenCalled();

        ffprobeSpy.mockRestore();
    });
});
