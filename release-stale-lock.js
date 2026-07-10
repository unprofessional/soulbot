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
        const { rows } = await client.query(
            "SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = $1 AND objid = $2 AND granted = true AND pid != pg_backend_pid()",
            ["advisory", lockId]
        );
        if (rows.length > 0) {
            console.log(
                `[pre-start] Terminated ${rows.length} stale session(s) holding advisory lock ${lockId}`
            );
        }
    } catch (err) {
        console.warn("[pre-start] Could not clear stale locks:", err.message);
    } finally {
        await client.end().catch(() => {});
    }
}

releaseStaleLock();
