/**
 * Pre-start cleanup: terminate any postgres sessions holding the
 * advisory leader lock from a previous container that didn't shut
 * down cleanly. Safe to run - only kills sessions holding OUR lock.
 */
const { Client } = require("pg");
const {
    pgHost,
    pgPort,
    pgUser,
    pgPass,
    pgDb,
} = require("./config/env_config.js");

const lockId = Number(process.env.LEADER_LOCK_ID || "424242");
const cleanupAttempts = Number(process.env.LEADER_LOCK_CLEANUP_ATTEMPTS || "5");
const cleanupRetryMs = Number(process.env.LEADER_LOCK_CLEANUP_RETRY_MS || "1000");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function releaseStaleLock() {
    const client = new Client({
        host: pgHost,
        port: pgPort,
        user: pgUser,
        password: pgPass,
        database: pgDb,
    });

    try {
        await client.connect();
        for (let attempt = 1; attempt <= cleanupAttempts; attempt += 1) {
            const { rows } = await client.query(
                `SELECT pid, pg_terminate_backend(pid) AS terminated
                 FROM pg_locks
                 WHERE locktype = $1
                   AND classid = 0
                   AND objid = $2
                   AND granted = true
                   AND pid != pg_backend_pid()`,
                ["advisory", lockId]
            );

            const terminatedCount = rows.filter(row => row.terminated).length;
            if (terminatedCount > 0) {
                console.log(
                    `[pre-start] Terminated ${terminatedCount} stale session(s) holding advisory lock ${lockId}`
                );
                return;
            }

            if (attempt < cleanupAttempts) {
                await sleep(cleanupRetryMs);
            }
        }

        console.log(`[pre-start] No stale advisory lock ${lockId} found.`);
    } catch (err) {
        console.warn("[pre-start] Could not clear stale locks:", err.message);
    } finally {
        await client.end().catch(() => {});
    }
}

releaseStaleLock();
