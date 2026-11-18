const { randomBytes } = require('node:crypto');
const { diagnostics, liveAllowedRoles } = require('./permissions.js');
const { nextNumberSentence } = require('./presentation.js');
const { rolesOf } = require('./domain.js');
const keyOf = (guildId, channelId) => `${guildId}:${channelId}`;
const configured = new Set();
function isCountingChannel(guildId, channelId) { return configured.has(keyOf(guildId, channelId)); }
function remember(game) {
    const key = keyOf(game.guild_id, game.channel_id);
    if (game.state === 'retired') configured.delete(key); else configured.add(key);
}
function bounded(work, ms = 4000) {
    let timer;
    return Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Notice delivery timed out; delivery may be uncertain.')), ms);
    })]).finally(() => clearTimeout(timer));
}
class CountingNotices {
    constructor({ dao, client, serial, track, accepting, now = Date.now, timeout = 4000, schedule = setTimeout }) {
        Object.assign(this, { dao, client, serial, track, accepting, now, timeout, schedule });
        this.games = new Map(); this.blocked = new Set(); this.cutoffs = new Map(); this.health = new Map(); this.episodes = new Map();
        this.generation = new Map(); this.disconnected = new Set(); this.inflight = new Map(); this.recoveredGeneration = new Map(); this.scans = new Map();
    }
    remember(game) {
        remember(game);
        const key = keyOf(game.guild_id, game.channel_id);
        if (game.state === 'retired') { this.games.delete(key); this.blocked.delete(key); this.episodes.delete(key); this.health.delete(key); this.cutoffs.delete(key); } else this.games.set(key, game);
    }
    status(guildId, channelId) { return this.health.get(keyOf(guildId, channelId)) || ''; }
    isBlocked(guildId, channelId) { return [...this.scans.values()].some(id => id === null || id === this.client.guilds.cache.get(guildId)?.shardId) || this.disconnected.has(this.client.guilds.cache.get(guildId)?.shardId) || this.blocked.has(keyOf(guildId, channelId)); }
    cutoff(guildId, channelId) { return this.cutoffs.get(keyOf(guildId, channelId)) || 0; }
    async load() {
        const games = await this.dao.list();
        for (const game of games) this.remember(game);
        return games;
    }
    async channel(game) {
        const guild = this.client.guilds.cache.get(game.guild_id);
        if (!guild) return null;
        const channel = await guild.channels.fetch(game.channel_id).catch(error => { if (error.code === 10003) return null; throw error; });
        if (!channel || channel.guildId !== game.guild_id || channel.type !== 0) return null;
        return channel;
    }
    async send(channel, content, nonce, timeout = this.timeout) {
        if (!channel) throw new Error('Counting channel is unavailable.');
        // Nonce makes retrying a timed-out send less likely to duplicate its notice.
        return bounded(channel.send({ content, allowedMentions: { parse: [] }, nonce, enforceNonce: true }), timeout);
    }
    disconnect(shardId) {
        if (this.disconnected.has(shardId)) return;
        this.disconnected.add(shardId);
        this.generation.set(shardId, (this.generation.get(shardId) || 0) + 1);
        for (const [key, game] of this.games) {
            if (this.client.guilds.cache.get(game.guild_id)?.shardId === shardId) this.blocked.add(key);
        }
    }
    recover(shardId = null, scanAttempt = 0) {
        const recoveryKey = shardId === null ? `all:${JSON.stringify([...this.generation])}` : `${shardId}:${this.generation.get(shardId) || 0}`;
        if (this.inflight.has(recoveryKey)) return this.inflight.get(recoveryKey);
        if (shardId !== null && this.recoveredGeneration.get(shardId) === (this.generation.get(shardId) || 0)) return Promise.resolve();
        if (shardId === null) this.disconnected.clear(); else this.disconnected.delete(shardId);
        this.scans.set(recoveryKey, shardId);
        // Called synchronously by the gateway listener, before any submissions can be reopened.
        const selected = [...this.games.values()].filter(g => shardId === null || this.client.guilds.cache.get(g.guild_id)?.shardId === shardId);
        for (const game of selected) this.blocked.add(keyOf(game.guild_id, game.channel_id));
        const generations = new Map(this.generation);
        const work = (async () => {
            const games = await bounded(this.load(), this.timeout);
            for (const game of games) {
                if (shardId === null || this.client.guilds.cache.get(game.guild_id)?.shardId === shardId) this.blocked.add(keyOf(game.guild_id, game.channel_id));
            }
            this.scans.delete(recoveryKey);
            let cursor = 0;
            await Promise.all(Array.from({ length: 4 }, async () => {
                while (cursor < games.length) {
                    const game = games[cursor++];
                    if (shardId !== null && this.client.guilds.cache.get(game.guild_id)?.shardId !== shardId) continue;
                    const key = keyOf(game.guild_id, game.channel_id);
                    this.blocked.add(key);
                    await this.serial(key, async () => {
                        try { await this.recoveryAttempt(game, 0, generations.get(this.client.guilds.cache.get(game.guild_id)?.shardId) || 0); }
                        finally {
                            const id = this.client.guilds.cache.get(game.guild_id)?.shardId;
                            if ((generations.get(id) || 0) === (this.generation.get(id) || 0)) {
                                this.cutoffs.set(key, this.now()); this.blocked.delete(key);
                                this.recoveredGeneration.set(id, this.generation.get(id) || 0);
                            }
                        }
                    });
                }
            }));
        })().catch(error => {
            console.error('[counting] Recovery scan failed:', error.message);
            if (scanAttempt < 2 && this.accepting()) {
                const timer = this.schedule(() => {
                    if (this.accepting()) this.recover(shardId, scanAttempt + 1);
                }, (scanAttempt + 1) * 2000);
                timer.unref?.();
            }
            // A failed scan must not leave all known channels gated indefinitely.
            for (const game of selected) {
                const key = keyOf(game.guild_id, game.channel_id);
                this.health.set(key, 'Recovery scan failed; use /counting status and retry after the connection returns.');
                this.cutoffs.set(key, this.now()); this.blocked.delete(key);
            }
        });
        const tracked = this.track(work.finally(() => { this.scans.delete(recoveryKey); this.inflight.delete(recoveryKey); }));
        this.inflight.set(recoveryKey, tracked);
        return tracked;
    }
    async recoveryAttempt(game, attempt, epoch) {
        const key = keyOf(game.guild_id, game.channel_id);
        const isCurrent = () => (this.generation.get(this.client.guilds.cache.get(game.guild_id)?.shardId) || 0) === epoch;
        if (!isCurrent()) return;
        try {
            const guild = this.client.guilds.cache.get(game.guild_id);
            if (!guild || guild.available === false) throw new Error('Guild temporarily unavailable; no missing target confirmed.');
            const channel = await bounded(this.channel(game), this.timeout);
            const current = await bounded(this.dao.get(game.guild_id, game.channel_id), this.timeout);
            if (!current || current.state === 'retired') return;
            const roles = channel && await bounded(liveAllowedRoles(channel.guild, current), this.timeout);
            if (!channel) await bounded(this.dao.suspendMissing(game.guild_id, 'channel_id', game.channel_id), this.timeout);
            else {
                for (const id of rolesOf(current)) if (!roles.has(id)) await bounded(this.dao.suspendMissing(game.guild_id, 'role_id', id), this.timeout);
            }
            const state = !channel || !roles?.size || diagnostics(channel, channel.guild).required.length ? 'suspended' : current.state;
            if (!isCurrent()) return;
            this.health.set(key, `Recovery complete; counting ${state}.`);
            this.clearFailure(key);
        } catch (error) {
            if (!isCurrent()) return;
            this.health.set(key, `Recovery failed (attempt ${attempt + 1}/3). Check channel access; /counting status shows saved progress.`);
            console.error('[counting] Recovery failed:', game.channel_id, error.message);
            if (attempt < 2 && this.accepting() && isCurrent()) {
                const timer = this.schedule(() => {
                    if (this.accepting()) this.track(this.serial(key, () => this.recoveryAttempt(game, attempt + 1, epoch))).catch(console.error);
                }, (attempt + 1) * 2000);
                timer.unref?.();
            }
        }
    }
    clearFailure(key) { this.episodes.delete(key); }
    recovered(guildId, channelId) {
        const key = keyOf(guildId, channelId);
        if (this.episodes.has(key)) this.health.set(key, 'Counting recovered; outage warning cleared.');
        this.clearFailure(key);
    }
    async failure(channel, uncertain = false) {
        const key = keyOf(channel.guildId, channel.id);
        let episode = this.episodes.get(key);
        if (episode && (episode.sending || this.now() < episode.retryAfter || (episode.delivered && this.now() - episode.delivered < 60000))) return;
        if (!episode) { episode = { tries: 0, delivered: 0, retryAfter: 0, nonce: randomBytes(12).toString('hex') }; this.episodes.set(key, episode); }
        if (episode.tries >= 3 && !episode.delivered) return;
        if (episode.delivered) { episode.nonce = randomBytes(12).toString('hex'); episode.tries = 0; }
        episode.sending = true; episode.tries++;
        let content = uncertain ? 'Could not confirm your number. Check /counting current before trying again.' : 'Counting unavailable. That number was not counted. Check /counting status or ask a manager.';
        try {
            // A failed lookup must never invent a next number or prevent the bounded warning.
            let current;
            try { current = await bounded(this.dao.get(channel.guildId, channel.id), this.timeout); }
            catch { /* Keep the original warning when saved state is unavailable. */ }
            if (this.episodes.get(key) !== episode || current?.state === 'retired') return;
            if (current) content += ` ${nextNumberSentence(current)}`;
            await this.send(channel, content, episode.nonce);
            episode.delivered = this.now();
            this.health.set(key, 'Outage warning delivered; awaiting verified counting recovery.');
        } catch (error) {
            this.health.set(key, 'Outage warning could not be delivered. Check channel access.');
            console.error('[counting] Outage warning failed:', error.message);
            episode.retryAfter = this.now() + episode.tries * 2000;
            if (episode.tries < 3 && this.accepting()) {
                const timer = this.schedule(() => {
                    if (this.accepting() && this.episodes.get(key) === episode) this.track(this.failure(channel, uncertain)).catch(console.error);
                }, episode.tries * 2000);
                timer.unref?.();
            }
        } finally { episode.sending = false; }
    }
    async down(reason = '') {
        // There is no way to announce a crash/disconnect before it happens. This handles graceful drains.
        const content = /SIGTERM|restart|update/i.test(reason) ? 'Restarting. Numbers posted during restart may be missed.' : 'Going offline. Numbers posted while offline may be missed.';
        const games = [...this.games.values()]; let cursor = 0;
        const deadline = Date.now() + 5000;
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (cursor < games.length) {
                const game = games[cursor++];
                if (Date.now() >= deadline) return;
                try {
                    const channel = await bounded(this.channel(game), Math.min(this.timeout, Math.max(1, deadline - Date.now())));
                    await this.send(channel, content, undefined, Math.min(this.timeout, Math.max(1, deadline - Date.now())));
                }
                catch (error) { this.health.set(keyOf(game.guild_id, game.channel_id), 'Shutdown notice failed.'); console.error('[counting] Shutdown notice failed:', error.message); }
            }
        }));
    }
}
module.exports = { CountingNotices, remember, isCountingChannel, keyOf, bounded };
