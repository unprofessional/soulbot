const { runTaskPool } = require('../scripts/benchmark-twitter-video.js');

describe('Twitter video benchmark concurrency', () => {
    test('preserves task order while limiting active work', async () => {
        let active = 0;
        let peakActive = 0;
        const releases = [];
        const tasks = Array.from({ length: 5 }, (_, index) => async () => {
            active += 1;
            peakActive = Math.max(peakActive, active);
            await new Promise(resolve => releases.push(resolve));
            active -= 1;
            return index;
        });

        const resultPromise = runTaskPool(tasks, 2);
        while (releases.length < 2) await Promise.resolve();
        releases.shift()();
        while (releases.length < 2) await Promise.resolve();
        releases.shift()();
        while (releases.length < 2) await Promise.resolve();
        releases.shift()();
        while (releases.length < 2) await Promise.resolve();
        releases.shift()();
        releases.shift()();

        await expect(resultPromise).resolves.toEqual([0, 1, 2, 3, 4]);
        expect(peakActive).toBe(2);
    });

    test('runs no more workers than tasks', async () => {
        await expect(runTaskPool([async () => 'only'], 3)).resolves.toEqual(['only']);
        await expect(runTaskPool([], 3)).resolves.toEqual([]);
    });
});
