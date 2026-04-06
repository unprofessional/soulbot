jest.mock('../features/twitter-core/twitter_post_utils.js', () => ({
    countDirectoriesInDirectory: jest.fn(),
}));

jest.mock('../features/twitter-core/path_builder.js', () => ({
    buildPathsAndStuff: jest.fn(),
}));

jest.mock('../features/twitter-video', () => ({
    downloadVideo: jest.fn(),
    getVideoFileSize: jest.fn(),
    bakeImageAsFilterIntoVideo: jest.fn(),
}));

jest.mock('../features/twitter-video/twitter_video_canvas.js', () => ({
    createTwitterVideoCanvas: jest.fn(),
}));

jest.mock('../features/twitter-core/webhook_utils.js', () => ({
    sendVideoReply: jest.fn(),
}));

jest.mock('../features/twitter-video/cleanup.js', () => ({
    cleanup: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../features/twitter-core/estimate_output_size', () => ({
    estimateOutputSizeBytes: jest.fn(),
    inspectVideoFileDetails: jest.fn(),
}));

const { countDirectoriesInDirectory } = require('../features/twitter-core/twitter_post_utils.js');
const { buildPathsAndStuff } = require('../features/twitter-core/path_builder.js');
const {
    downloadVideo,
    getVideoFileSize,
    bakeImageAsFilterIntoVideo,
} = require('../features/twitter-video');
const { createTwitterVideoCanvas } = require('../features/twitter-video/twitter_video_canvas.js');
const { sendVideoReply } = require('../features/twitter-core/webhook_utils.js');
const { cleanup } = require('../features/twitter-video/cleanup.js');
const { inspectVideoFileDetails } = require('../features/twitter-core/estimate_output_size');
const { handleVideoPost } = require('../features/twitter-core/twitter_video_handler.js');

function buildMessageMock() {
    return {
        guildId: 'guild-1',
        guild: { name: 'Test Guild' },
        client: {
            guilds: {
                cache: {
                    get: jest.fn(() => ({ premiumTier: 0 })),
                },
            },
        },
        reply: jest.fn().mockResolvedValue(undefined),
    };
}

function buildProgressMock() {
    return {
        update: jest.fn().mockResolvedValue(undefined),
        dismiss: jest.fn().mockResolvedValue(undefined),
    };
}

describe('handleVideoPost progress lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        countDirectoriesInDirectory.mockResolvedValue(0);
        buildPathsAndStuff.mockReturnValue({
            filename: 'video-file',
            localWorkingPath: '/tempdata/video-file',
        });
        downloadVideo.mockResolvedValue(undefined);
        createTwitterVideoCanvas.mockResolvedValue({
            canvasHeight: 600,
            canvasWidth: 560,
            heightShim: 120,
        });
        bakeImageAsFilterIntoVideo.mockResolvedValue('/tempdata/video-file/video-file-output.mp4');
        getVideoFileSize.mockResolvedValue(1024);
        inspectVideoFileDetails.mockResolvedValue({ width: 1280, height: 720 });
        sendVideoReply.mockResolvedValue(undefined);
    });

    test('cleans up the placeholder when the queue is at capacity', async () => {
        countDirectoriesInDirectory.mockResolvedValue(3);
        const message = buildMessageMock();
        const progressMessage = buildProgressMock();

        await handleVideoPost({
            metadataJson: { communityNote: 'note' },
            message,
            originalLink: 'https://x.com/test/status/1',
            videoUrl: 'https://video.example.com/file.mp4',
            processingDir: '/tempdata',
            MAX_CONCURRENT_REQUESTS: 3,
            progressMessage,
        });

        expect(progressMessage.dismiss).toHaveBeenCalledTimes(1);
        expect(message.reply).toHaveBeenCalledWith({
            content: 'Video processing at capacity; try again later.',
            allowedMentions: { repliedUser: false },
        });
        expect(cleanup).not.toHaveBeenCalled();
    });

    test('dismisses the placeholder after a successful upload', async () => {
        const message = buildMessageMock();
        const progressMessage = buildProgressMock();

        await handleVideoPost({
            metadataJson: {
                communityNote: 'note',
                _videos: [{ size: { width: 1280, height: 720 } }],
            },
            message,
            originalLink: 'https://x.com/test/status/2',
            videoUrl: 'https://video.example.com/file.mp4',
            processingDir: '/tempdata',
            MAX_CONCURRENT_REQUESTS: 3,
            progressMessage,
        });

        expect(progressMessage.update).toHaveBeenCalledWith('Uploading the rendered Twitter/X video...');
        expect(sendVideoReply).toHaveBeenCalledWith(
            message,
            '/tempdata/video-file/video-file-output.mp4',
            'https://x.com/test/status/2',
            { main: 'note', qt: undefined },
        );
        expect(progressMessage.dismiss).toHaveBeenCalledTimes(1);
        expect(cleanup).toHaveBeenCalledWith([], ['/tempdata/video-file']);
        expect(message.reply).not.toHaveBeenCalled();
    });

    test('dismisses the placeholder before the file-too-large fallback reply', async () => {
        const message = buildMessageMock();
        const progressMessage = buildProgressMock();
        const uploadError = new Error('too large');
        uploadError.name = 'DiscordAPIError[40005]';
        sendVideoReply.mockRejectedValue(uploadError);

        await handleVideoPost({
            metadataJson: {
                communityNote: 'note',
                _videos: [{ size: { width: 1280, height: 720 } }],
            },
            message,
            originalLink: 'https://x.com/test/status/3',
            videoUrl: 'https://video.example.com/file.mp4',
            processingDir: '/tempdata',
            MAX_CONCURRENT_REQUESTS: 3,
            progressMessage,
        });

        expect(progressMessage.dismiss).toHaveBeenCalledTimes(1);
        expect(progressMessage.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
            message.reply.mock.invocationCallOrder[0]
        );
        expect(message.reply).toHaveBeenCalledWith({
            content: 'Discord upload rejected the rendered video because it was too large for this server tier. Defaulting to FIXUPX link: https://fixupx.com/test/status/3',
            allowedMentions: { repliedUser: false },
        });
        expect(cleanup).toHaveBeenCalledWith([], ['/tempdata/video-file']);
    });

    test('dismisses the placeholder before replying on unexpected processing errors', async () => {
        const message = buildMessageMock();
        const progressMessage = buildProgressMock();
        createTwitterVideoCanvas.mockRejectedValue(new Error('canvas failed'));

        await handleVideoPost({
            metadataJson: {
                communityNote: 'note',
                _videos: [{ size: { width: 1280, height: 720 } }],
            },
            message,
            originalLink: 'https://x.com/test/status/4',
            videoUrl: 'https://video.example.com/file.mp4',
            processingDir: '/tempdata',
            MAX_CONCURRENT_REQUESTS: 3,
            progressMessage,
        });

        expect(progressMessage.dismiss).toHaveBeenCalledTimes(1);
        expect(progressMessage.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
            message.reply.mock.invocationCallOrder[0]
        );
        expect(message.reply).toHaveBeenCalledWith({
            content: 'Video processing failed for this post. Try again later or use FIXUPX: https://fixupx.com/test/status/4',
            allowedMentions: { repliedUser: false },
        });
        expect(cleanup).toHaveBeenCalledWith([], ['/tempdata/video-file']);
    });
});
