jest.mock('../app/lifecycle.js', () => ({
    isDraining: jest.fn(),
}));

const { isDraining } = require('../app/lifecycle.js');
const {
    MediaDrainError,
    getActiveJobs,
    onIdle,
    runTrackedMediaJob,
} = require('../app/media_work_registry.js');

describe('media_work_registry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isDraining.mockReturnValue(false);
    });

    test('rejects new media jobs while draining', async () => {
        isDraining.mockReturnValue(true);

        await expect(
            runTrackedMediaJob({ kind: 'twitter-video', label: 'tweet-1' }, async () => 'ok')
        ).rejects.toBeInstanceOf(MediaDrainError);
    });

    test('tracks active jobs until they settle', async () => {
        let release;

        const jobPromise = runTrackedMediaJob(
            { kind: 'twitter-video', label: 'tweet-2' },
            async () => new Promise((resolve) => {
                release = resolve;
            })
        );

        expect(getActiveJobs()).toEqual([
            expect.objectContaining({
                kind: 'twitter-video',
                label: 'tweet-2',
                processCount: 0,
            }),
        ]);

        const idlePromise = onIdle();
        release('done');

        await expect(jobPromise).resolves.toBe('done');
        await expect(idlePromise).resolves.toBeUndefined();
        expect(getActiveJobs()).toEqual([]);
    });
});
