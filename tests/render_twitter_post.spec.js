jest.mock('../features/twitter-core/twitter_post_utils.js', () => ({
    createDirectoryIfNotExists: jest.fn().mockResolvedValue(undefined),
    extractFirstVideoUrl: jest.fn(() => null),
    isFirstMediaVideo: jest.fn(() => false),
}));

jest.mock('../features/twitter-core/twitter_video_handler.js', () => ({
    handleVideoPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../features/twitter-core/twitter_gif_handler.js', () => ({
    handleGifPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../features/twitter-core/twitter_image_handler.js', () => ({
    handleImagePost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../features/twitter-core/path_builder.js', () => ({
    createProcessingRunId: jest.fn(() => 'run-123'),
    buildPathsAndStuff: jest.fn(() => ({
        filename: 'video-file',
        localWorkingPath: '/tempdata/run-123',
    })),
}));

jest.mock('../features/twitter-core/progress_message.js', () => ({
    createVideoProgressMessage: jest.fn().mockResolvedValue({
        update: jest.fn(),
        dismiss: jest.fn(),
    }),
}));

jest.mock('../features/twitter-core/utils.js', () => ({
    collectMedia: jest.fn(),
    formatTwitterDate: jest.fn(() => 'Apr 4, 2026'),
}));

const { renderTwitterPost } = require('../features/twitter-core/render_twitter_post.js');
const { handleVideoPost } = require('../features/twitter-core/twitter_video_handler.js');
const { handleGifPost } = require('../features/twitter-core/twitter_gif_handler.js');
const { handleImagePost } = require('../features/twitter-core/twitter_image_handler.js');
const { createVideoProgressMessage } = require('../features/twitter-core/progress_message.js');
const { collectMedia } = require('../features/twitter-core/utils.js');
const { buildPathsAndStuff } = require('../features/twitter-core/path_builder.js');

describe('renderTwitterPost community note flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([[[]], [[{ type: 'image', url: 'https://example.com/main.jpg' }]]])(
        'only promotes quoted video when primary media is empty: %j', async (primaryMedia) => {
            const video = { type: 'video', url: 'https://example.com/quote.mp4' };
            const quote = { text: 'quoted video' };
            collectMedia.mockImplementation(meta => meta === quote ? [video] : primaryMedia);
            await renderTwitterPost({ text: 'primary', qtMetadata: quote }, {}, 'https://x.com/a/status/1');
            if (primaryMedia.length === 0) {
                expect(handleVideoPost).toHaveBeenCalledWith(expect.objectContaining({
                    videoUrl: video.url,
                    metadataJson: expect.objectContaining({ _quoteVideoMedia: video, qtMetadata: quote }),
                }));
                expect(handleImagePost).not.toHaveBeenCalled();
            } else {
                expect(handleVideoPost).not.toHaveBeenCalled();
                expect(handleImagePost).toHaveBeenCalled();
            }
        },
    );

    test('passes community note through the normal image post path', async () => {
        collectMedia.mockReturnValue([
            { type: 'image', url: 'https://example.com/image.jpg' },
        ]);

        const metadataJson = {
            text: 'hello',
            communityNote: 'Context for the image post.',
        };

        await renderTwitterPost(metadataJson, { reply: jest.fn() }, 'https://x.com/test/status/1');

        expect(handleImagePost).toHaveBeenCalledWith(expect.objectContaining({
            metadataJson: expect.objectContaining({
                communityNote: 'Context for the image post.',
            }),
            originalLink: 'https://x.com/test/status/1',
        }));
        expect(createVideoProgressMessage).not.toHaveBeenCalled();
        expect(handleVideoPost).not.toHaveBeenCalled();
    });

    test('passes community note through the video post path', async () => {
        collectMedia.mockReturnValue([
            { type: 'video', url: 'https://example.com/video.mp4' },
        ]);

        const metadataJson = {
            text: 'video',
            communityNote: 'Context for the video post.',
        };

        await renderTwitterPost(metadataJson, { reply: jest.fn() }, 'https://x.com/test/status/2');

        expect(createVideoProgressMessage).toHaveBeenCalledTimes(1);
        expect(handleVideoPost).toHaveBeenCalledWith(expect.objectContaining({
            metadataJson: expect.objectContaining({
                communityNote: 'Context for the video post.',
            }),
            originalLink: 'https://x.com/test/status/2',
            videoUrl: 'https://example.com/video.mp4',
            processingRunId: 'run-123',
            pathInfo: {
                filename: 'video-file',
                localWorkingPath: '/tempdata/run-123',
            },
            progressMessage: expect.objectContaining({
                update: expect.any(Function),
                dismiss: expect.any(Function),
            }),
        }));
        expect(buildPathsAndStuff).toHaveBeenCalledWith(
            '/tempdata',
            'https://example.com/video.mp4',
            'run-123',
        );
        expect(handleImagePost).not.toHaveBeenCalled();
    });

    test('routes VX GIF media to the native GIF renderer', async () => {
        collectMedia.mockReturnValue([{
            type: 'gif',
            url: 'https://video.twimg.com/tweet_video/animated.mp4',
            size: { width: 448, height: 252 },
        }]);

        await renderTwitterPost(
            { text: 'gif', communityNote: 'Context for the GIF.' },
            { reply: jest.fn() },
            'https://x.com/test/status/3',
        );

        expect(createVideoProgressMessage).toHaveBeenCalledWith(
            expect.anything(),
            'Rendering the Twitter/X GIF canvas...',
            'GIF',
        );
        expect(handleGifPost).toHaveBeenCalledWith(expect.objectContaining({
            gifUrl: 'https://video.twimg.com/tweet_video/animated.mp4',
            metadataJson: expect.objectContaining({
                _gifs: [expect.objectContaining({ type: 'gif' })],
            }),
        }));
        expect(handleVideoPost).not.toHaveBeenCalled();
        expect(handleImagePost).not.toHaveBeenCalled();
    });
});
