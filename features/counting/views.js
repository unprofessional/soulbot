const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../../store/db/pool.js');
const { canRead } = require('./permissions.js');
const { roleLabel, stateLabel } = require('./presentation.js');
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
function pageFooter(result, page) {
    const pages = Math.max(1, Math.ceil(Number(result.total) / PAGE_SIZE));
    if (page > pages) return `Page ${page} is unavailable. Choose page ${pages} (last page).`;
    return `Page ${page}/${pages}. Ties share places (1, 1, 3). Live results may move between pages.`;
}
async function buildView(i, viewer, action, params = {}) {
    if (!available) throw Object.assign(new Error('Counting rankings are unavailable. Core counting is still available.'), { userFacing: true });
    const page = params.page ?? i.options?.getInteger?.('page') ?? 1;
    // Refresh channel overwrites and role permissions; never rank hidden games and filter afterward.
    const [channels, roles] = await Promise.all([i.guild.channels.fetch(), i.guild.roles.fetch()]);
    let content, result, scope, channelId;
    if (action === 'leaderboard') {
        const visibleIds = [...channels.values()].filter(c => canRead(c, viewer, i.guildId)).map(c => c.id);
        result = await dao.leaderboard(i.guildId, visibleIds, page);
        const lines = result.entries.map(row => `${row.place}. <#${row.channel_id}> · ${roleLabel(row, roles)} — ${row.current_count} (record ${row.record}; ${stateLabel(row.state)})`);
        content = `**Team standings — ranked by current count**\n${lines.join('\n') || (Number(result.total) ? 'No entries on this page.' : 'No visible counting teams. Use /counting help to find a game or manager setup steps.')}\n${pageFooter(result, page)}`;
    } else {
        channelId = params.channelId || i.options?.getChannel?.('channel')?.id || i.channelId || i.channel?.id;
        const channel = channels.get(channelId);
        if (!canRead(channel, viewer, i.guildId)) throw Object.assign(new Error('You need View Channel and Read Message History for that counting channel.'), { userFacing: true });
        scope = params.scope || i.options?.getString?.('scope') || 'lifetime';
        result = await dao.top(i.guildId, channel.id, scope, page);
        if (!result) throw Object.assign(new Error('No counting game is configured here.'), { userFacing: true });
        const lines = await Promise.all(result.entries.map(async row => {
            const member = await i.guild.members.fetch({ user: row.author_id, cache: false }).catch(() => null);
            const label = member ? `<@${row.author_id}>` : `Member (${row.author_id}; unavailable)`;
            return `${row.place}. ${label} — ${row.contributions} accepted numbers`;
        }));
        content = `**Top contributors · <#${channel.id}>**\n${scope === 'run' ? 'Since the last restart at 1 (not a bot restart)' : 'All accepted contributions for this team history'} · ${stateLabel(result.state)}\n${lines.join('\n') || (Number(result.total) ? 'No entries on this page.' : 'No accepted contributions yet. Use /counting current to begin; resets clear this period only when current-run is selected.')}\n${pageFooter(result, page)}`;
    }
    // Ephemeral output and suppressed mentions prevent cross-channel disclosure and notification spam.
    return { content, page, pages: Math.max(1, Math.ceil(Number(result.total) / PAGE_SIZE)), scope, channelId };
}
async function replyView(i, viewer, action) {
    const view = await buildView(i, viewer, action);
    return i.editReply({ content: view.content, allowedMentions: { parse: [] } });
}
module.exports = { replyView, buildView, canRead, dao, initializeViews };
