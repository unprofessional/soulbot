jest.mock('../features/twitter-core/twitter_post_utils.js', () => ({
    createDirectoryIfNotExists: jest.fn().mockResolvedValue(undefined),
    extractFirstVideoUrl: jest.fn(() => null),
    isFirstMediaVideo: jest.fn(() => false),
}));

jest.mock('../features/twitter-core/twitter_video_handler.js', () => ({
    handleVideoPost: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../features/twitter-core/twitter_image_handler.js', () => ({
    handleImagePost: jest.fn().mockResolvedValue(undefined),
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
const { handleImagePost } = require('../features/twitter-core/twitter_image_handler.js');
const { createVideoProgressMessage } = require('../features/twitter-core/progress_message.js');
const { collectMedia } = require('../features/twitter-core/utils.js');

describe('renderTwitterPost community note flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

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
            progressMessage: expect.objectContaining({
                update: expect.any(Function),
                dismiss: expect.any(Function),
            }),
        }));
        expect(handleImagePost).not.toHaveBeenCalled();
    });
});
