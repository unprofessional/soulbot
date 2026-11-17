const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../../store/db/pool.js');
const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const { CountingViewsDAO, PAGE_SIZE } = require('../../store/dao/counting_views.dao.js');
const dao = new CountingViewsDAO();
let available = false;
async function initializeViews() {
    available = false;
    try {
        await pool.query(await fs.readFile(path.join(__dirname, '../../store/db/tables/counting_views.sql'), 'utf8'));
        available = true;
    } catch (error) { console.error('[counting] Rankings unavailable; core counting remains active:', error.message); }
}
function canRead(channel, viewer, guildId) {
    const permissions = channel?.permissionsFor?.(viewer);
    return channel?.guildId === guildId && channel.type === ChannelType.GuildText
        && Boolean(permissions?.has([P.ViewChannel, P.ReadMessageHistory]));
}
function pageFooter(result, page) {
    const pages = Math.max(1, Math.ceil(Number(result.total) / PAGE_SIZE));
    return `Page ${page}/${pages}. Live results; totals may change between pages.`;
}
async function replyView(i, viewer, action) {
    if (!available) throw new Error('Counting rankings are unavailable. Core counting is still available.');
    const page = i.options.getInteger('page') ?? 1;
    // Refresh channel overwrites and role permissions; never rank hidden games and filter afterward.
    const [channels] = await Promise.all([i.guild.channels.fetch(), i.guild.roles.fetch()]);
    let content;
    if (action === 'leaderboard') {
        const visibleIds = [...channels.values()].filter(c => canRead(c, viewer, i.guildId)).map(c => c.id);
        const result = await dao.leaderboard(i.guildId, visibleIds, page);
        const lines = result.entries.map(row => `${row.place}. <#${row.channel_id}> · <@&${row.role_id}> — ${row.current_count} (record ${row.record}; ${row.state})`);
        content = `Team standings\n${lines.join('\n') || (Number(result.total) ? 'No entries on this page.' : 'No visible counting teams.')}\n${pageFooter(result, page)}`;
    } else {
        const channelId = i.options.getChannel('channel')?.id || i.channelId || i.channel?.id;
        const channel = channels.get(channelId);
        if (!canRead(channel, viewer, i.guildId)) throw new Error('You need View Channel and Read Message History for that counting channel.');
        const scope = i.options.getString('scope') || 'lifetime';
        const result = await dao.top(i.guildId, channel.id, scope, page);
        if (!result) throw new Error('No counting game is configured here.');
        const lines = await Promise.all(result.entries.map(async row => {
            const member = await i.guild.members.fetch({ user: row.author_id, cache: false }).catch(() => null);
            const label = member ? `<@${row.author_id}>` : `Member (${row.author_id}; unavailable)`;
            return `${row.place}. ${label} — ${row.contributions}`;
        }));
        content = `Top counters · <#${channel.id}> · ${scope === 'run' ? 'current run' : 'lifetime (current history)'} · ${result.state}\n${lines.join('\n') || (Number(result.total) ? 'No entries on this page.' : 'No accepted contributions yet.')}\n${pageFooter(result, page)}`;
    }
    // Ephemeral output and suppressed mentions prevent cross-channel disclosure and notification spam.
    return i.editReply({ content, allowedMentions: { parse: [] } });
}
module.exports = { replyView, canRead, dao, initializeViews };
