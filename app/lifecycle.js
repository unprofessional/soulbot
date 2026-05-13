const cleanupHandlers = [];
const drainHandlers = [];

const state = {
    isReady: false,
    isDraining: false,
    drainHandlersPromise: null,
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

function registerDrainHandler(name, fn) {
    drainHandlers.push({ name, fn });
    console.log(`[Lifecycle] Registered drain handler: ${name}`);
}

async function runDrainHandlers() {
    if (state.drainHandlersPromise) {
        return state.drainHandlersPromise;
    }

    state.drainHandlersPromise = (async () => {
        console.log(`[Lifecycle] Running ${drainHandlers.length} drain handler(s)`);

        for (const { name, fn } of drainHandlers) {
            try {
                console.log(`[Lifecycle] Running drain handler: ${name}`);
                await fn(state.shutdownReason);
            } catch (error) {
                console.error(`[Lifecycle] Drain handler failed: ${name}`, error);
            }
        }
    })();

    return state.drainHandlersPromise;
}

async function drain(reason = 'shutdown requested') {
    startDraining(reason);
    await runDrainHandlers();
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

    state.shutdownPromise = (async () => {
        await drain(`signal=${signal}`);
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
    registerDrainHandler,
    drain,
    shouldAcceptWork,
    shutdown,
    startDraining,
};
