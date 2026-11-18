const fs = require('node:fs/promises');
const path = require('node:path');
const { PermissionFlagsBits: P, Events } = require('discord.js');
const { pool } = require('../../store/db/pool.js');
const { CountingDAO } = require('../../store/dao/counting.dao.js');
const { shouldAcceptWork, registerDrainHandler } = require('../../app/lifecycle.js');
const { shouldHandle } = require('./domain.js');
const { initializeViews } = require('./views.js');
const { diagnostics } = require('./permissions.js');
const { rejection } = require('./presentation.js');
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
function getNotices() { return notices; }
function connected(guildId, channelId) {
    return onlineSince !== Infinity && !notices?.isBlocked(guildId, channelId);
}
async function validateTarget(guild, channel, roleId) {
    if (channel.guildId !== guild.id || channel.type !== 0) throw new Error('Choose a normal text channel in this server.');
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
    if (diagnostics(message.channel, message.guild).required.length || !connected(message.guildId, message.channelId)) {
        await notices?.failure(message.channel); return true;
    }
    // Never replay old submissions after startup, including delayed duplicate gateway events.
    if (message.createdTimestamp < Math.max(onlineSince, notices?.cutoff(message.guildId, message.channelId) || 0)) return true;
    return serial(`${message.guildId}:${message.channelId}`, async () => {
        const result = await dao.submit(message.guildId, message.channelId, attempt, async current => {
            const role = await message.guild.roles.fetch(current.role_id);
            if (!role) throw Object.assign(new Error('Team role deleted'), { missingRole: true, roleId: current.role_id });
            const member = await message.guild.members.fetch({ user: message.author.id, force: true });
            return member.roles.cache.has(current.role_id);
        });
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
}
async function handleMessage(message) {
    if (!message.guildId) return false;
    if (!ready || !shouldAcceptWork()) return false;
    try { return await track(processMessage(message)); }
    catch (error) {
        console.error('[counting] Submission failed:', error.message);
        if (notices?.games.has(`${message.guildId}:${message.channelId}`)) await notices.failure(message.channel, !error.missingRole);
        if (error.missingRole) await dao.suspendMissing(message.guildId, 'role_id', error.roleId).catch(console.error);
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
