const { createHash } = require('node:crypto');
const { nextNumberSentence } = require('./presentation.js');
const { bounded } = require('./notices.js');
const RECENT_WINDOW_MS = 15 * 60 * 1000;
function isNumberAttempt(message) {
    return !message.author?.bot && !message.webhookId && !message.attachments?.size
        && /^\d+$/.test((message.content || '').trim());
}
class OfflineFeedback {
    constructor({ dao, accepting, now = Date.now, limit = 5000, timeout = 4000 }) {
        Object.assign(this, { dao, accepting, now, limit, timeout });
        this.claimed = new Map();
    }
    async prepare(message, cutoff) {
        const now = this.now(), timestamp = message.createdTimestamp;
        if (!this.accepting() || !isNumberAttempt(message) || !Number.isFinite(timestamp) || !Number.isFinite(cutoff)
            || timestamp >= cutoff || timestamp > now || now - timestamp > RECENT_WINDOW_MS
            || now - cutoff > RECENT_WINDOW_MS || timestamp < cutoff - RECENT_WINDOW_MS) return;
        const key = `${message.guildId}:${message.channelId}:${message.id}`;
        for (const [id, expires] of this.claimed) if (expires <= now) this.claimed.delete(id);
        if (this.claimed.has(key)) return;
        if (this.claimed.size >= this.limit) return; // Preserve existing dedup claims under saturation.
        // Claim before any awaits. Failed/ambiguous replies are not retried as fresh gateway events.
        this.claimed.set(key, now + RECENT_WINDOW_MS);
        try {
            if (await bounded(this.dao.hasMessageEvent(message.guildId, message.channelId, message.id), this.timeout)) return;
            const current = await bounded(this.dao.get(message.guildId, message.channelId), this.timeout);
            if (!current || current.state === 'retired' || !this.accepting()) return;
            const content = `Not counted — that was posted while the bot was offline. ${nextNumberSentence(current)}${current.state !== 'active' ? ' Counting is paused or needs repair; check /counting status.' : ''}`;
            return { content, allowedMentions: { parse: [], repliedUser: false },
                nonce: createHash('sha256').update(`counting-offline:${key}`).digest('hex').slice(0, 24), enforceNonce: true };
        } catch (error) { console.error('[counting] Offline-number feedback failed:', error.message); }
    }
    async deliver(message, reply) {
        if (!reply || !this.accepting()) return;
        try { await bounded(message.reply(reply), this.timeout); }
        catch (error) { console.error('[counting] Offline-number reply failed:', error.message); }
    }
}
module.exports = { OfflineFeedback, isNumberAttempt, RECENT_WINDOW_MS };
