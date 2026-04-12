jest.mock('../features/twitter-core/thread_snapshot_utils.js', () => ({
    fetchTweetById: jest.fn(),
}));

jest.mock('../features/twitter-core/thread_snapshot_canvas.js', () => ({
    renderThreadSnapshotCanvas: jest.fn(),
}));

jest.mock('../features/twitter-core/twitter_post_utils.js', () => ({
    extractTweetIdFromUrl: jest.fn(),
}));

jest.mock('../features/twitter-core/translation_service.js', () => ({
    buildDisplayText: jest.fn(post => post.text || ''),
    translateMetadataBatchToEnglish: jest.fn(async (posts) => posts),
}));

const { fetchTweetById } = require('../features/twitter-core/thread_snapshot_utils.js');
const { renderThreadSnapshotCanvas } = require('../features/twitter-core/thread_snapshot_canvas.js');
const { extractTweetIdFromUrl } = require('../features/twitter-core/twitter_post_utils.js');
const { buildDisplayText, translateMetadataBatchToEnglish } = require('../features/twitter-core/translation_service.js');
const { handleThreadSnapshot } = require('../features/twitter-core/thread_snapshot_handler.js');

describe('thread_snapshot_handler translation flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('batch-enriches fetched posts with translation before rendering', async () => {
        extractTweetIdFromUrl.mockReturnValue('123');
        fetchTweetById
            .mockResolvedValueOnce({
                tweetID: '123',
                replyingToID: '122',
                user_screen_name: 'child',
                text: 'ola',
                media_extended: [],
            })
            .mockResolvedValueOnce({
                tweetID: '122',
                replyingToID: null,
                user_screen_name: 'parent',
                text: 'bom dia',
                media_extended: [],
            });
        renderThreadSnapshotCanvas.mockResolvedValue(Buffer.from('png'));

        const result = await handleThreadSnapshot('https://x.com/user/status/123');

        expect(result).toEqual(Buffer.from('png'));
        expect(translateMetadataBatchToEnglish).toHaveBeenCalledTimes(1);
        expect(translateMetadataBatchToEnglish).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ tweetID: '122' }),
                expect.objectContaining({ tweetID: '123' }),
            ]),
            expect.any(Function)
        );
        expect(renderThreadSnapshotCanvas).toHaveBeenCalledWith(expect.objectContaining({
            posts: expect.arrayContaining([
                expect.objectContaining({ tweetID: '122' }),
                expect.objectContaining({ tweetID: '123' }),
            ]),
        }));
    });

    test('uses translated display text in plain text fallback when canvas render fails', async () => {
        extractTweetIdFromUrl.mockReturnValue('123');
        fetchTweetById.mockResolvedValue({
            tweetID: '123',
            replyingToID: null,
            user_screen_name: 'child',
            text: 'ola',
            media_extended: [],
        });
        buildDisplayText.mockReturnValue('ola [Translated from Portuguese] hello');
        renderThreadSnapshotCanvas.mockRejectedValue(new Error('canvas failed'));

        const result = await handleThreadSnapshot('https://x.com/user/status/123');

        expect(result).toContain('**@child**: ola [Translated from Portuguese] hello');
    });
});
