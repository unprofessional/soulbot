const fs = require('node:fs/promises');
const path = require('node:path');
const { PermissionFlagsBits: P, Events } = require('discord.js');
const { pool } = require('../../store/db/pool.js');
const { CountingDAO } = require('../../store/dao/counting.dao.js');
const { shouldAcceptWork, registerDrainHandler } = require('../../app/lifecycle.js');
const { shouldHandle, rolesOf } = require('./domain.js');
const { initializeViews } = require('./views.js');
const { diagnostics, liveAllowedRoles } = require('./permissions.js');
const { rejection } = require('./presentation.js');
const { OfflineFeedback, isNumberAttempt } = require('./offline_feedback.js');
const { CountingNotices, bounded } = require('./notices.js');
const dao = new CountingDAO();
let ready = false;
let onlineSince = Infinity;
const pending = new Set();
const queues = new Map();
function track(work) {
    pending.add(work);
    work.finally(() => pending.delete(work)).catch(() => {});
    return work;
}
function serial(key, fn) {
    const work = (queues.get(key) || Promise.resolve()).catch(() => {}).then(fn);
    queues.set(key, work);
    work.finally(() => { if (queues.get(key) === work) queues.delete(key); }).catch(() => {});
    return track(work);
}
let notices;
let offlineFeedback;
function getNotices() { return notices; }
function connected(guildId, channelId) {
    return onlineSince !== Infinity && !notices?.isBlocked(guildId, channelId);
}
async function validateTarget(guild, channel, roleId) {
    if (channel.guildId !== guild.id || channel.type !== 0) throw new Error('Choose a normal text channel in this server.');
    if (!roleId) throw new Error('No existing allowed roles. Use /counting role-add role:… here, then resume.');
    const role = await guild.roles.fetch(roleId);
    if (!role || role.id === guild.id || role.managed) throw new Error('Choose an existing normal team role in this server.');
    await guild.members.fetchMe({ force: true });
    if (diagnostics(channel, guild).required.length) throw new Error('Soulbot needs View Channel, Read Message History, and Send Messages here.');
}
async function processMessage(message) {
    const game = await dao.get(message.guildId, message.channelId);
    if (!game) return false;
    if (game.guild_id && game.channel_id) notices?.remember(game);
    const attempt = {
        authorId: message.author.id, messageId: message.id,
        content: message.content || '', attachments: message.attachments.size > 0,
    };
    if (!shouldHandle(game, attempt)) return false;
    if (message.author.bot || message.webhookId) return true;
    const processed = await serial(`${message.guildId}:${message.channelId}`, async () => {
        // Check the cutoff under the same queue as recovery and counting. Gap posts never replay.
        const cutoff = Math.max(onlineSince, notices?.cutoff(message.guildId, message.channelId) || 0);
        if (message.createdTimestamp < cutoff) {
            return { offlineReply: await offlineFeedback.prepare(message, cutoff) };
        }
        if (diagnostics(message.channel, message.guild).required.length || !connected(message.guildId, message.channelId)) {
            if (isNumberAttempt(message) && shouldAcceptWork()) {
                try {
                    if (!await bounded(dao.hasMessageEvent(message.guildId, message.channelId, message.id))) await notices?.failure(message.channel);
                } catch (error) { console.error('[counting] Outage message check failed:', error.message); }
            }
            return true;
        }
        let missing = [], validIds;
        const result = await dao.submit(message.guildId, message.channelId, attempt, async current => {
            const roles = await liveAllowedRoles(message.guild, current);
            missing = rolesOf(current).filter(id => !roles.has(id));
            validIds = [...roles.keys()];
            if (!roles.size) throw Object.assign(new Error('No allowed roles remain'), { missingRoles: missing });
            const member = await message.guild.members.fetch({ user: message.author.id, force: true });
            return validIds.some(id => member.roles.cache.has(id));
        });
        for (const id of missing) await dao.suspendMissing(message.guildId, 'role_id', id).catch(error => console.error('[counting] Deleted-role cleanup failed:', error.message));
        if (result && validIds) result.game = { ...result.game, role_ids: validIds };
        if (!result || result.outcome === 'ignored') return false;
        if (result.outcome === 'duplicate') return true;
        notices?.recovered(message.guildId, message.channelId);
        try {
            if (result.outcome === 'accepted') await message.react('✅');
            else {
                await message.reply({ content: rejection(result), allowedMentions: { parse: [], repliedUser: false } });
                if (['format', 'ineligible', 'alternation', 'wrong', 'reset'].includes(result.outcome)) {
                    if (message.channel.permissionsFor(message.guild.members.me)?.has(P.ManageMessages)) await message.delete();
                }
            }
        } catch (error) { console.error('[counting] Feedback failed; committed state retained:', error.message); }
        return true;
    });
    if (processed && typeof processed === 'object' && Object.hasOwn(processed, 'offlineReply')) {
        // Delivery is tracked and bounded, but never holds the channel queue/recovery gate.
        await offlineFeedback.deliver(message, processed.offlineReply);
        return true;
    }
    return processed;
}
async function handleMessage(message) {
    if (!message.guildId) return false;
    if (!ready || !shouldAcceptWork()) return false;
    try { return await track(processMessage(message)); }
    catch (error) {
        console.error('[counting] Submission failed:', error.message);
        if (isNumberAttempt(message) && notices?.games.has(`${message.guildId}:${message.channelId}`)) await notices.failure(message.channel, !error.missingRoles);
        for (const id of error.missingRoles || []) await dao.suspendMissing(message.guildId, 'role_id', id).catch(console.error);
        // Fail closed: an uncertain counting submission must not enter transformation handlers.
        return true;
    }
}
async function initializeCounting(client) {
    ready = false;
    try {
        await pool.query(await fs.readFile(path.join(__dirname, '../../store/db/tables/counting.sql'), 'utf8'));
        ready = true;
        await initializeViews();
    } catch (error) { console.error('[counting] Unavailable: schema initialization failed', error.message); }
    offlineFeedback = new OfflineFeedback({ dao, accepting: shouldAcceptWork });
    notices = new CountingNotices({ dao, client, serial, track, accepting: shouldAcceptWork });
    if (ready && typeof dao.list === 'function') {
        try { await bounded(notices.load()); } catch (error) { console.error('[counting] Notice configuration unavailable:', error.message); }
    }
    let hasReady = false;
    client.once(Events.ClientReady, () => {
        hasReady = true; onlineSince = Date.now();
        if (ready) void notices.recover();
    });
    const suspend = (guildId, field, id) => {
        if (ready && shouldAcceptWork()) track(dao.suspendMissing(guildId, field, id)).catch(error => console.error('[counting] Suspension failed', error));
    };
    client.on(Events.ShardDisconnect, (_event, id) => { notices.disconnect(id); });
    const reconnect = id => {
        if (hasReady && ready) void notices.recover(id);
    };
    client.on(Events.ShardReconnecting, id => notices.disconnect(id));
    client.on(Events.ShardResume, id => reconnect(id));
    client.on(Events.ShardReady, id => reconnect(id));
    client.on(Events.GuildRoleDelete, role => suspend(role.guild.id, 'role_id', role.id));
    client.on(Events.ChannelDelete, channel => { if (channel.guildId) suspend(channel.guildId, 'channel_id', channel.id); });
    registerDrainHandler('finish counting work and notify channels', async reason => {
        await Promise.allSettled([...pending]);
        await bounded(notices.down(reason), 6000).catch(error => console.error('[counting] Shutdown notice budget exhausted:', error.message));
    });
}
module.exports = { dao, diagnostics, validateTarget, handleMessage, initializeCounting, isAvailable: () => ready, track, serial, getNotices, connected };
