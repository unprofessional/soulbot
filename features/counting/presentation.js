const { PermissionFlagsBits: P } = require('discord.js');
const { MAX_COUNT } = require('./domain.js');
const { diagnostics } = require('./permissions.js');
const safe = value => String(value).replace(/[@`*_~|<>\\]/g, '').slice(0, 100);
const roleLabel = (game, roles) => roles?.has(game.role_id) ? `<@&${game.role_id}>` : 'Deleted team role';
const stateLabel = state => ({ active: 'Active', paused: 'Paused', suspended: 'Needs repair', retired: 'Retired' }[state] || 'Unavailable');
const next = game => game.current_count < MAX_COUNT ? String(game.current_count + 1) : 'Limit reached; reset needed';
const rules = game => `${game.allow_consecutive ? 'You may count consecutive numbers.' : 'Teammates take turns; no two turns in a row.'}\n${game.mistake_policy === 'reset' ? 'Wrong numbers restart the count at 1.' : 'Wrong numbers keep progress.'}`;
function availability(game, channel, guild, roles, connected = true) {
    if (game.state !== 'active') return stateLabel(game.state);
    if (!roles?.has(game.role_id)) return 'Team role deleted';
    if (!connected) return 'Reconnecting';
    if (diagnostics(channel, guild).required.length) return 'Missing bot permissions';
    if (game.current_count >= MAX_COUNT) return 'Limit reached';
    return 'Ready to count';
}
function participation(game, channel, guild, roles, viewer, connected = true) {
    const state = availability(game, channel, guild, roles, connected);
    if (state !== 'Ready to count') return `${state}. ${game.state === 'retired' ? 'Normal chat is allowed; a manager can resume this game.' : 'Ask a manager to check /counting status.'}`;
    if (!viewer.roles?.cache.has(game.role_id)) return `You need ${roleLabel(game, roles)} — ask a server manager for the role.`;
    if (!channel.permissionsFor(viewer)?.has(P.SendMessages) || viewer.isCommunicationDisabled?.()) return 'You cannot send messages here. Ask a server manager for help.';
    if (!game.allow_consecutive && game.last_author_id === viewer.id) return `You counted last. Another teammate must post **${next(game)}**.`;
    return `Can count now. Post **${next(game)}** here.`;
}
const example = (action, channelId) => `/counting ${action} channel:<#${channelId}>`;
function readView(action, game, channel, guild, context, connected, delivery = '') {
    const heading = `**<#${channel.id}> · ${roleLabel(game, context.roles)}**`;
    const progress = `Last: **${game.current_count}** · Next: **${next(game)}** · Best: **${game.record}**`;
    const manager = context.viewer.permissions.has(P.ManageGuild);
    if (action === 'current') return `${heading}\n${progress}\n${participation(game, channel, guild, context.roles, context.viewer, connected)}\nPost numbers only. Rules: ${example('settings', channel.id)}`;
    if (action === 'settings' || action === 'configure') {
        return `${heading}\n**Rules**\n${rules(game)}\nMembers need the team role. Post numbers only; text, images, and expressions do not count.\nInvalid posts are removed when Soulbot has Manage Messages. Edits/deletions keep recorded progress. Offline numbers may be missed.\n${manager ? `Change rules: ${example('configure', channel.id)} mistakes:reset or consecutive:true\nChanging teams requires history:retain (keep progress/totals) or history:reset (start fresh; archive old totals).` : `Next: ${example('current', channel.id)}`}\nTeam standings: /counting leaderboard · Contributors: ${example('top', channel.id)}`;
    }
    const health = diagnostics(channel, guild);
    const status = availability(game, channel, guild, context.roles, connected);
    let repair = 'Next: check the current number before posting.';
    if (status !== 'Ready to count') repair = manager
        ? `${health.required.length ? `Grant Soulbot ${health.required.join(', ')} in this channel. ` : ''}${!context.roles.has(game.role_id) ? `Choose an existing team role with ${example('configure', channel.id)} role:… history:retain. ` : ''}${game.state !== 'active' ? `When fixed, use ${example('resume', channel.id)}. ` : ''}Then retry ${example('status', channel.id)}.`
        : 'Ask a server manager to repair/resume this game; numbers may not count.';
    if (status === 'Limit reached') repair = manager ? `Use ${example('reset', channel.id)} to start at 1; it preserves the best count and lifetime totals.` : 'Ask a manager to reset the game.';
    return `${heading}\n**${status}**\n${progress}\n${repair}${manager ? `\nOptional features: ${health.optional.length ? `missing ${health.optional.join(', ')} (reactions/cleanup only)` : 'reactions and cleanup available'}.${delivery ? `\nNotices: ${delivery}` : ''}\nBot readiness does not verify member access or team-only channel visibility.` : ''}`;
}
const managerSteps = '**Set up / add a team**\n1. Create/select a team role (e.g. Red Team); give it to at least two human teammates.\n2. Create/select a dedicated text channel (e.g. #red-count). Grant the team View Channel, Read Message History, and Send Messages. For team-only access, check other overrides too; owners/admins bypass restrictions, so test as ordinary members.\n3. Give Soulbot those same three permissions. Add Reactions enables check marks; Manage Messages enables invalid-post cleanup.\n4. Open that channel and run `/counting setup role:…`. Preview and confirm the defaults: take turns; wrong numbers keep progress. Change rules later with `/counting configure`.\n5. Check `/counting status`, post the channel guide, and test 1 then 2 as two ordinary members. Repeat for another team; compare with `/counting leaderboard`.\nExisting roles/channels can be reused. If you cannot create them, ask a server administrator. Setup assigns no roles and changes no channel permissions. A bot-ready status does not verify member access or team isolation.';
function guide(game, roles) {
    return `**Counting for ${roleLabel(game, roles)}**\nMembers need this team role and channel send access.\n${rules(game)}\nPost numbers only. ✅ means accepted; invalid posts may be removed.\nUse /counting current for the next number and your turn; /counting settings for current rules.\nOffline numbers may be missed. Edits/deletions do not undo accepted counts.\nGuide posted <t:${Math.floor(Date.now() / 1000)}:f>; rules may change.`;
}
function rejection(result) {
    const { game, outcome } = result;
    const expected = next(game);
    return {
        ineligible: `You need <@&${game.role_id}> to count here. Ask a server manager for the role.`,
        format: `Numbers only (no text/images/expressions). Expected **${expected}**. Your post was not counted; progress stays at **${game.current_count}**.`,
        alternation: `You counted last. Another teammate must post **${expected}**. Progress stays at **${game.current_count}**.`,
        wrong: `Expected **${expected}**. Your number was not counted; progress stays at **${game.current_count}**. Check /counting current for your turn.`,
        reset: 'Wrong number. Count restarted. Next: **1**. Any eligible teammate may begin.',
        paused: 'Counting is paused. Your number was not counted. Ask a manager to use /counting resume.',
        suspended: 'Counting needs repair. Your number was not counted. Ask a manager to check /counting status.',
        limit: 'Count limit reached. Ask a manager to use /counting reset.',
    }[outcome] || 'This game is retired. Normal chat is allowed.';
}
module.exports = { safe, roleLabel, stateLabel, next, rules, participation, availability, readView, managerSteps, guide, example, rejection };
