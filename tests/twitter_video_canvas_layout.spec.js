jest.mock('node:fs', () => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

jest.mock('canvas', () => ({
    createCanvas: jest.fn((width, height) => {
        const ctx = {
            canvas: { width, height },
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            closePath: jest.fn(),
            fill: jest.fn(),
            fillStyle: '#000',
            textDrawingMode: 'glyph',
            font: '',
            measureText: jest.fn(text => ({ width: String(text || '').length * 10 })),
            fillRect: jest.fn(),
            fillText: jest.fn(),
            drawImage: jest.fn(),
            beginPath: jest.fn(),
            arc: jest.fn(),
            clip: jest.fn(),
            save: jest.fn(),
            restore: jest.fn(),
        };

        return {
            width,
            height,
            getContext: jest.fn(() => ctx),
            toBuffer: jest.fn(() => Buffer.from('png')),
        };
    }),
    loadImage: jest.fn(async () => ({})),
}));

jest.mock('../features/twitter-core/path_builder.js', () => ({
    buildPathsAndStuff: jest.fn(() => ({
        filename: 'test-video',
        localWorkingPath: '/tempdata/test-video',
    })),
}));

const { createTwitterVideoCanvas } = require('../features/twitter-video/twitter_video_canvas.js');

describe('twitter_video_canvas empty-description spacing', () => {
    test('does not reserve a phantom text line when the description is empty', async () => {
        const result = await createTwitterVideoCanvas({
            user_screen_name: 'example',
            user_name: 'Example User',
            user_profile_image_url: '',
            lang: 'zxx',
            text: 'https://t.co/abcdef',
            mediaURLs: ['https://video.example.com/video.mp4'],
            media_extended: [{
                type: 'video',
                url: 'https://video.example.com/video.mp4',
                size: { width: 1280, height: 720 },
            }],
            _canvasOutputPath: '/tempdata/test-video/test-video.png',
        });

        expect(result.canvasHeight).toBe(465);
    });

    test('keeps one text line when the description is present', async () => {
        const result = await createTwitterVideoCanvas({
            user_screen_name: 'example',
            user_name: 'Example User',
            user_profile_image_url: '',
            lang: 'en',
            text: 'hello world',
            mediaURLs: ['https://video.example.com/video.mp4'],
            media_extended: [{
                type: 'video',
                url: 'https://video.example.com/video.mp4',
                size: { width: 1280, height: 720 },
            }],
            _canvasOutputPath: '/tempdata/test-video/test-video.png',
        });

        expect(result.canvasHeight).toBe(495);
    });

    test('uses GIF dimensions instead of the tall missing-media fallback', async () => {
        const result = await createTwitterVideoCanvas({
            user_screen_name: 'IsraeliFlowery',
            user_name: 'Israeli Flowery',
            user_profile_image_url: '',
            lang: 'en',
            text: '> deltarune theory video\n> troon voice',
            mediaURLs: ['https://video.twimg.com/tweet_video/HQ7MHzNWEAAXCC4.mp4'],
            media_extended: [{
                type: 'gif',
                url: 'https://video.twimg.com/tweet_video/HQ7MHzNWEAAXCC4.mp4',
                size: { width: 448, height: 252 },
            }],
            _canvasOutputPath: '/tempdata/test-gif/test-gif.png',
        });

        expect(result.heightShim).toBe(315);
        expect(result.canvasHeight).toBe(525);
    });
});
