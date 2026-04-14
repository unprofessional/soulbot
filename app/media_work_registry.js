const { isDraining } = require('./lifecycle.js');

class MediaDrainError extends Error {
    constructor(message = 'Media work is draining') {
        super(message);
        this.name = 'MediaDrainError';
    }
}

const activeJobs = new Map();
const idleWaiters = [];
let nextJobId = 1;

function ensureAcceptingNewMediaWork() {
    if (isDraining()) {
        throw new MediaDrainError();
    }
}

function resolveIdleWaitersIfNeeded() {
    if (activeJobs.size !== 0) {
        return;
    }

    while (idleWaiters.length > 0) {
        const resolve = idleWaiters.shift();
        resolve();
    }
}

function registerMediaJob({ kind = 'media', label = 'unnamed-job' } = {}) {
    ensureAcceptingNewMediaWork();

    const jobId = `${kind}-${nextJobId++}`;
    const processes = new Set();
    const job = {
        id: jobId,
        kind,
        label,
        processes,
        startedAt: Date.now(),
    };

    activeJobs.set(jobId, job);
    console.log(`[MediaWork] Registered ${jobId}: ${label}`);

    return {
        id: jobId,

        attachProcess(proc, { label: processLabel = 'child-process' } = {}) {
            if (!proc) {
                return;
            }

            const entry = { proc, label: processLabel };
            processes.add(entry);

            const cleanup = () => {
                processes.delete(entry);
            };

            proc.once?.('exit', cleanup);
            proc.once?.('close', cleanup);

            if (proc.pid) {
                console.log(`[MediaWork] ${jobId} attached pid=${proc.pid} (${processLabel})`);
            }
        },

        async finish() {
            activeJobs.delete(jobId);
            const durationMs = Date.now() - job.startedAt;
            console.log(`[MediaWork] Finished ${jobId}: ${label} (${durationMs}ms)`);
            resolveIdleWaitersIfNeeded();
        },
    };
}

async function runTrackedMediaJob(meta, work) {
    const job = registerMediaJob(meta);

    try {
        return await work(job);
    } finally {
        await job.finish();
    }
}

function onIdle() {
    if (activeJobs.size === 0) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        idleWaiters.push(resolve);
    });
}

function getActiveJobs() {
    return Array.from(activeJobs.values()).map((job) => ({
        id: job.id,
        kind: job.kind,
        label: job.label,
        startedAt: job.startedAt,
        processCount: job.processes.size,
    }));
}

module.exports = {
    MediaDrainError,
    ensureAcceptingNewMediaWork,
    getActiveJobs,
    onIdle,
    runTrackedMediaJob,
};
