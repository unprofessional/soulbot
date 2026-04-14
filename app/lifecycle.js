const cleanupHandlers = [];

const state = {
    isReady: false,
    isDraining: false,
    shutdownReason: null,
    shutdownPromise: null,
};

function markReady() {
    state.isReady = true;
}

function isReady() {
    return state.isReady && !state.isDraining;
}

function isDraining() {
    return state.isDraining;
}

function shouldAcceptWork() {
    return !state.isDraining;
}

function startDraining(reason = 'shutdown requested') {
    if (state.isDraining) {
        return false;
    }

    state.isDraining = true;
    state.shutdownReason = reason;
    console.log(`[Lifecycle] Draining started: ${reason}`);
    return true;
}

function registerCleanup(name, fn) {
    cleanupHandlers.push({ name, fn });
}

async function runCleanupHandlers() {
    for (const { name, fn } of cleanupHandlers) {
        try {
            console.log(`[Lifecycle] Running cleanup: ${name}`);
            await fn();
        } catch (error) {
            console.error(`[Lifecycle] Cleanup failed: ${name}`, error);
        }
    }
}

async function shutdown({ signal = 'unknown', exitCode = 0 } = {}) {
    if (state.shutdownPromise) {
        return state.shutdownPromise;
    }

    startDraining(`signal=${signal}`);

    state.shutdownPromise = (async () => {
        await runCleanupHandlers();
        return exitCode;
    })();

    return state.shutdownPromise;
}

function getState() {
    return {
        isReady: state.isReady,
        isDraining: state.isDraining,
        shutdownReason: state.shutdownReason,
    };
}

module.exports = {
    getState,
    isDraining,
    isReady,
    markReady,
    registerCleanup,
    shouldAcceptWork,
    shutdown,
    startDraining,
};
