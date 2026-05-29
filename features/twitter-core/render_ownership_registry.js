const DEFAULT_TTL_MS = 5 * 60 * 1000;

const pendingOwnershipByWebhookId = new Map();

function pruneExpiredEntries(now = Date.now()) {
    for (const [webhookId, entry] of pendingOwnershipByWebhookId.entries()) {
        if (!entry?.expiresAt || entry.expiresAt <= now) {
            pendingOwnershipByWebhookId.delete(webhookId);
        }
    }
}

function registerPendingRenderOwnership(webhookId, metadata, ttlMs = DEFAULT_TTL_MS) {
    if (!webhookId || !metadata) return;

    pruneExpiredEntries();

    pendingOwnershipByWebhookId.set(String(webhookId), {
        ...metadata,
        expiresAt: Date.now() + ttlMs,
    });
}

function consumePendingRenderOwnership(webhookId) {
    if (!webhookId) return null;

    pruneExpiredEntries();

    const key = String(webhookId);
    const entry = pendingOwnershipByWebhookId.get(key);
    if (!entry) return null;

    pendingOwnershipByWebhookId.delete(key);

    const metadata = { ...entry };
    delete metadata.expiresAt;
    return metadata;
}

module.exports = {
    registerPendingRenderOwnership,
    consumePendingRenderOwnership,
};
