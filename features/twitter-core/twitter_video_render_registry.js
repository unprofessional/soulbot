const activeVideoRenders = new Map();

function extractStatusId(originalLink) {
    if (typeof originalLink !== 'string') return null;
    const match = originalLink.match(/\/status\/(\d+)/i);
    return match?.[1] || null;
}

function buildTwitterVideoRenderKey({ metadataJson, originalLink, videoUrl } = {}) {
    const tweetId =
        metadataJson?.tweetID ||
        metadataJson?.tweet?.id ||
        metadataJson?.id ||
        extractStatusId(originalLink);

    if (tweetId) return `tweet:${tweetId}`;
    if (originalLink) return `url:${String(originalLink).replace(/\?.*$/, '')}`;
    return `video:${videoUrl}`;
}

function acquireTwitterVideoRender(key) {
    if (!key) {
        throw new Error('acquireTwitterVideoRender requires a key');
    }

    const existing = activeVideoRenders.get(key);
    if (existing) {
        existing.refCount += 1;
        return buildHandle(existing, false);
    }

    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    // The leader drives completion directly; this prevents Node from treating a
    // failed render as unhandled when no duplicate arrived to await it.
    promise.catch(() => {});

    const entry = {
        key,
        promise,
        resolve,
        reject,
        refCount: 1,
        settled: false,
        cleanup: null,
        cleanupPromise: null,
    };

    activeVideoRenders.set(key, entry);
    return buildHandle(entry, true);
}

function buildHandle(entry, isLeader) {
    return {
        key: entry.key,
        isLeader,
        promise: entry.promise,

        complete(value) {
            if (entry.settled) return;
            entry.settled = true;
            entry.resolve(value);
        },

        fail(error) {
            if (entry.settled) return;
            entry.settled = true;
            entry.reject(error);
        },

        setCleanup(cleanup) {
            entry.cleanup = cleanup;
        },

        async release() {
            entry.refCount = Math.max(0, entry.refCount - 1);
            if (!entry.settled || entry.refCount > 0) {
                return;
            }

            activeVideoRenders.delete(entry.key);
            if (!entry.cleanup) {
                return;
            }

            if (!entry.cleanupPromise) {
                entry.cleanupPromise = Promise.resolve().then(entry.cleanup);
            }

            await entry.cleanupPromise;
        },
    };
}

function getActiveTwitterVideoRenderKeys() {
    return Array.from(activeVideoRenders.keys());
}

function clearTwitterVideoRenderRegistryForTests() {
    activeVideoRenders.clear();
}

module.exports = {
    acquireTwitterVideoRender,
    buildTwitterVideoRenderKey,
    clearTwitterVideoRenderRegistryForTests,
    getActiveTwitterVideoRenderKeys,
};
