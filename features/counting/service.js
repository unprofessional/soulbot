const fs = require('node:fs/promises');
const path = require('node:path');
const { PermissionFlagsBits: P, Events } = require('discord.js');
const { pool } = require('../../store/db/pool.js');
const { CountingDAO } = require('../../store/dao/counting.dao.js');
const { shouldAcceptWork, registerDrainHandler } = require('../../app/lifecycle.js');
const { shouldHandle } = require('./domain.js');
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
function diagnostics(channel, guild) {
    const permissions = channel.permissionsFor(guild.members.me);
    const required = [P.ViewChannel, P.ReadMessageHistory, P.SendMessages];
    return {
        required: required.filter(bit => !permissions?.has(bit)).map(String),
        optional: [P.AddReactions, P.ManageMessages].filter(bit => !permissions?.has(bit)).map(String),
    };
}
async function validateTarget(guild, channel, roleId) {
    if (channel.guildId !== guild.id || channel.type !== 0) throw new Error('Choose a normal text channel in this server.');
    const role = await guild.roles.fetch(roleId);
    if (!role || role.id === guild.id || role.managed) throw new Error('Choose an existing normal team role in this server.');
    await guild.members.fetchMe();
    if (diagnostics(channel, guild).required.length) throw new Error('Soulbot needs View Channel, Read Message History, and Send Messages here.');
}
async function processMessage(message) {
    const game = await dao.get(message.guildId, message.channelId);
    if (!game) return false;
    const attempt = {
        authorId: message.author.id, messageId: message.id,
        content: message.content || '', attachments: message.attachments.size > 0,
    };
    if (!shouldHandle(game, attempt)) return false;
    if (message.author.bot || message.webhookId) return true;
    if (diagnostics(message.channel, message.guild).required.length) return true;
    // Never replay old submissions after startup, including delayed duplicate gateway events.
    if (message.createdTimestamp < onlineSince) return true;
    return serial(`${message.guildId}:${message.channelId}`, async () => {
        const result = await dao.submit(message.guildId, message.channelId, attempt, async current => {
            const role = await message.guild.roles.fetch(current.role_id);
            if (!role) throw Object.assign(new Error('Team role deleted'), { missingRole: true, roleId: current.role_id });
            const member = await message.guild.members.fetch({ user: message.author.id, force: true });
            return member.roles.cache.has(current.role_id);
        });
        if (!result || result.outcome === 'ignored') return false;
        if (result.outcome === 'duplicate') return true;
        const next = result.game.current_count + 1;
        const explanations = {
            ineligible: 'You need this channel’s team role to count.',
            format: `Post only a positive whole number (up to ${Number.MAX_SAFE_INTEGER}). Expected ${next}.`,
            alternation: `Let another team member count ${next} first.`,
            wrong: `Expected ${next}. Progress was preserved.`,
            reset: `Expected ${next}. The count reset; start again at 1.`,
            paused: 'Counting is paused.', suspended: 'Counting is suspended; ask a manager to check status.',
            retired: 'This counting game is retired.', limit: 'The maximum count has been reached; ask a manager to reset.',
        };
        try {
            if (result.outcome === 'accepted') await message.react('✅');
            else {
                await message.reply({ content: explanations[result.outcome], allowedMentions: { parse: [], repliedUser: false } });
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
    } catch (error) { console.error('[counting] Unavailable: schema initialization failed', error.message); }
    client.once(Events.ClientReady, () => {
        onlineSince = Date.now();
        if (ready) track((async () => {
            const games = await pool.query("SELECT guild_id,channel_id,role_id FROM counting_game WHERE state <> 'retired'");
            for (const game of games.rows) {
                const guild = client.guilds.cache.get(game.guild_id);
                if (!guild) continue;
                // Only a successful fetch returning null proves a missing target.
                const channel = await guild.channels.fetch(game.channel_id).catch(error => { if (error.code === 10003) return null; throw error; });
                const role = await guild.roles.fetch(game.role_id).catch(error => { if (error.code === 10011) return null; throw error; });
                if (!channel) await dao.suspendMissing(game.guild_id, 'channel_id', game.channel_id);
                if (!role) await dao.suspendMissing(game.guild_id, 'role_id', game.role_id);
            }
        })()).catch(error => console.error('[counting] Startup reconciliation failed:', error.message));
    });
    const suspend = (guildId, field, id) => {
        if (ready && shouldAcceptWork()) track(dao.suspendMissing(guildId, field, id)).catch(error => console.error('[counting] Suspension failed', error));
    };
    client.on(Events.ShardDisconnect, () => { onlineSince = Infinity; });
    client.on(Events.ShardResume, () => { onlineSince = Date.now(); });
    client.on(Events.ShardReady, () => { onlineSince = Date.now(); });
    client.on(Events.GuildRoleDelete, role => suspend(role.guild.id, 'role_id', role.id));
    client.on(Events.ChannelDelete, channel => { if (channel.guildId) suspend(channel.guildId, 'channel_id', channel.id); });
    registerDrainHandler('finish counting work', async () => { await Promise.allSettled([...pending]); });
}
module.exports = { dao, diagnostics, validateTarget, handleMessage, initializeCounting, isAvailable: () => ready, track, serial };
