jest.mock('pg', () => ({
    Client: jest.fn(),
}));

const { Client } = require('pg');
const { createLeaderLock } = require('../store/db/leader_lock.js');

describe('leader lock', () => {
    beforeEach(() => {
        Client.mockReset();
    });

    test('acquires the advisory lock and releases it on close', async () => {
        const query = jest
            .fn()
            .mockResolvedValueOnce({ rows: [{ acquired: false }] })
            .mockResolvedValueOnce({ rows: [{ acquired: true }] })
            .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });

        Client.mockImplementation(() => ({
            connect: jest.fn().mockResolvedValue(),
            query,
            end: jest.fn().mockResolvedValue(),
        }));

        const leaderLock = createLeaderLock({
            lockId: 123,
            retryDelayMs: 1,
            log: { log: jest.fn() },
        });

        await leaderLock.acquire();
        await leaderLock.close();

        expect(query).toHaveBeenNthCalledWith(
            1,
            'SELECT pg_try_advisory_lock($1) AS acquired',
            [123]
        );
        expect(query).toHaveBeenNthCalledWith(
            2,
            'SELECT pg_try_advisory_lock($1) AS acquired',
            [123]
        );
        expect(query).toHaveBeenNthCalledWith(
            3,
            'SELECT pg_advisory_unlock($1)',
            [123]
        );
    });
});
