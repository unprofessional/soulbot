const PromiseQueue = require('../lib/promise_queue');

describe('PromiseQueue drain controls', () => {
    test('pause prevents new tasks from being accepted', async () => {
        const queue = new PromiseQueue(1, 1000);
        queue.pause();

        await expect(queue.add(async () => 'ok')).rejects.toMatchObject({
            name: 'QueueDrainingError',
        });
    });

    test('onIdle waits for active work to finish', async () => {
        const queue = new PromiseQueue(1, 1000);
        let releaseTask;
        const activeTask = queue.add(async () => new Promise((resolve) => {
            releaseTask = resolve;
        }));

        const idlePromise = queue.onIdle();
        releaseTask('done');

        await expect(activeTask).resolves.toBe('done');
        await expect(idlePromise).resolves.toBeUndefined();
    });
});
