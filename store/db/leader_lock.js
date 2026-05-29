const { Client } = require('pg');

const {
    pgHost,
    pgPort,
    pgUser,
    pgPass,
    pgDb,
} = require('../../config/env_config.js');

function createLeaderLock({
    lockId,
    retryDelayMs = 2000,
    log = console,
} = {}) {
    const client = new Client({
        user: pgUser,
        host: pgHost,
        database: pgDb,
        password: pgPass,
        port: pgPort,
    });

    let connected = false;
    let acquired = false;

    return {
        async acquire({ shouldStop } = {}) {
            if (!connected) {
                await client.connect();
                connected = true;
            }

            while (!acquired) {
                if (shouldStop?.()) {
                    throw new Error('Leader lock acquisition cancelled');
                }

                const result = await client.query(
                    'SELECT pg_try_advisory_lock($1) AS acquired',
                    [lockId]
                );

                acquired = result.rows[0]?.acquired === true;

                if (acquired) {
                    log.log(`[LeaderLock] Acquired advisory lock ${lockId}`);
                    return;
                }

                log.log(
                    `[LeaderLock] Lock ${lockId} is held by another pod. Retrying in ${retryDelayMs}ms.`
                );

                await new Promise((resolve) => {
                    const timer = setTimeout(resolve, retryDelayMs);
                    timer.unref?.();
                });
            }
        },

        async release() {
            if (connected && acquired) {
                await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
                acquired = false;
                log.log(`[LeaderLock] Released advisory lock ${lockId}`);
            }
        },

        async close() {
            await this.release();

            if (connected) {
                await client.end();
                connected = false;
            }
        },
    };
}

module.exports = { createLeaderLock };
