const { MediaCapacitySemaphore } = require('../app/media_semaphore.js');
const {
    resolveTwitterVideoCapacity,
} = require('../features/twitter-core/twitter_video_capacity.js');

describe('MediaCapacitySemaphore', () => {
    test('acquires only up to capacity and makes release idempotent', () => {
        const semaphore = new MediaCapacitySemaphore({ name: 'test', capacity: 2 });
        const first = semaphore.tryAcquire({ jobId: 'job-1' });
        const second = semaphore.tryAcquire({ jobId: 'job-2' });

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(semaphore.tryAcquire({ jobId: 'job-3' })).toBeNull();
        expect(semaphore.getStats()).toEqual(expect.objectContaining({
            activeCount: 2,
            availableCount: 0,
        }));

        expect(first.release()).toBe(true);
        expect(first.release()).toBe(false);
        expect(semaphore.getStats().activeCount).toBe(1);
        const third = semaphore.tryAcquire({ jobId: 'job-3' });
        expect(third).not.toBeNull();
        second.release();
        third.release();
    });

    test.each(['success', 'failure', 'timeout', 'cancellation']) (
        'returns capacity after %s cleanup',
        async outcome => {
            const semaphore = new MediaCapacitySemaphore({ name: outcome, capacity: 1 });
            const permit = semaphore.tryAcquire({ jobId: `job-${outcome}` });

            try {
                if (outcome !== 'success') throw new Error(outcome);
            } catch {}
            finally {
                permit.release();
            }

            expect(semaphore.getStats().activeCount).toBe(0);
            const nextPermit = semaphore.tryAcquire();
            expect(nextPermit).not.toBeNull();
            nextPermit.release();
        }
    );

    test('rejects invalid capacity', () => {
        expect(() => new MediaCapacitySemaphore({ capacity: 0 })).toThrow(TypeError);
        expect(() => new MediaCapacitySemaphore({ capacity: 1.5 })).toThrow(TypeError);
    });
});

describe('Twitter video capacity configuration', () => {
    test.each([
        [undefined, 3],
        ['1', 1],
        ['2', 2],
        ['3', 3],
        ['0', 3],
        ['4', 3],
        ['invalid', 3],
    ])('resolves %p to %i', (value, expected) => {
        expect(resolveTwitterVideoCapacity(value)).toBe(expected);
    });
});
