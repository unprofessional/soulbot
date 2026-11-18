const { PermissionFlagsBits: P } = require('discord.js');
const { MAX_COUNT, rolesOf } = require('./domain.js');
const { diagnostics } = require('./permissions.js');
const safe = value => String(value).replace(/[@`*_~|<>\\]/g, '').slice(0, 100);
function roleLabel(game, roles, limit = 10) {
    const ids = rolesOf(game).filter(id => roles?.has(id));
    return ids.length ? ids.slice(0, limit).map(id => `<@&${id}>`).join(', ') + (ids.length > limit ? ` (+${ids.length - limit} more; see Rules)` : '') : 'No existing allowed roles';
}
const stateLabel = state => ({ active: 'Active', paused: 'Paused', suspended: 'Needs repair', retired: 'Retired' }[state] || 'Unavailable');
const next = game => game.current_count < MAX_COUNT ? String(game.current_count + 1) : 'Limit reached; reset needed';
const nextNumberSentence = game => game.current_count < MAX_COUNT ? `The next number is **${next(game)}**.` : 'Count limit reached; ask a manager to reset.';
const rules = game => `${game.allow_consecutive ? 'You may count consecutive numbers.' : 'Teammates take turns; no two turns in a row.'}\n${game.mistake_policy === 'reset' ? 'Wrong numbers restart the count at 1.' : 'Wrong numbers keep progress.'}`;
function availability(game, channel, guild, roles, connected = true) {
    if (game.state !== 'active') return stateLabel(game.state);
    if (!rolesOf(game).some(id => roles?.has(id))) return 'No existing allowed roles';
    if (!connected) return 'Reconnecting';
    if (diagnostics(channel, guild).required.length) return 'Missing bot permissions';
    if (game.current_count >= MAX_COUNT) return 'Limit reached';
    return 'Ready to count';
}
function participation(game, channel, guild, roles, viewer, connected = true) {
    const state = availability(game, channel, guild, roles, connected);
    if (state !== 'Ready to count') return `${state}. ${game.state === 'retired' ? 'Normal chat is allowed; a manager can resume this game.' : 'Ask a manager to check /counting status.'}`;
    if (!rolesOf(game).some(id => roles?.has(id) && viewer.roles?.cache.has(id))) return `You need any one of: ${roleLabel(game, roles)} — ask a server manager for a role.`;
    if (!channel.permissionsFor(viewer)?.has(P.SendMessages) || viewer.isCommunicationDisabled?.()) return 'You cannot send messages here. Ask a server manager for help.';
    if (!game.allow_consecutive && game.last_author_id === viewer.id) return `You counted last. Another teammate must post **${next(game)}**.`;
    return `Can count now. Post **${next(game)}** here.`;
}
const example = (action, channelId) => `/counting ${action} channel:<#${channelId}>`;
function readView(action, game, channel, guild, context, connected, delivery = '') {
    const heading = `**Team: <#${channel.id}>**\nAllowed roles (any one): ${roleLabel(game, context.roles)}`;
    const progress = `Last: **${game.current_count}** · Next: **${next(game)}** · Best: **${game.record}**`;
    const manager = context.viewer.permissions.has(P.ManageGuild);
    if (action === 'current') return `${heading}\n${progress}\n${participation(game, channel, guild, context.roles, context.viewer, connected)}\nPost numbers only. Rules: ${example('settings', channel.id)}`;
    if (action === 'settings' || action === 'configure') {
        return `${heading}\n**Rules**\n${rules(game)}\nMembers need any one allowed role; this channel is the team. Post numbers only; text, images, and expressions do not count.\nInvalid posts are removed when Soulbot has Manage Messages. Edits/deletions keep recorded progress. Offline numbers may be missed.\n${manager ? `Change rules: ${example('configure', channel.id)} mistakes:reset or consecutive:true\nAdd eligibility here: /counting role-add role:… (up to 10). Remove: /counting role-remove role:…. Role changes keep all channel progress and totals.` : `Next: ${example('current', channel.id)}`}\nTeam standings: /counting leaderboard · Contributors: ${example('top', channel.id)}`;
    }
    const health = diagnostics(channel, guild);
    const status = availability(game, channel, guild, context.roles, connected);
    let repair = 'Next: check the current number before posting.';
    if (status !== 'Ready to count') repair = manager
        ? `${health.required.length ? `Grant Soulbot ${health.required.join(', ')} in this channel. ` : ''}${!rolesOf(game).some(id => context.roles.has(id)) ? 'Open this channel and use /counting role-add role:… to allow an existing role. ' : ''}${game.state !== 'active' ? `When fixed, use ${example('resume', channel.id)}. ` : ''}Then retry ${example('status', channel.id)}.`
        : 'Ask a server manager to repair/resume this game; numbers may not count.';
    if (status === 'Limit reached') repair = manager ? `Use ${example('reset', channel.id)} to start at 1; it preserves the best count and lifetime totals.` : 'Ask a manager to reset the game.';
    return `${heading}\n**${status}**\n${progress}\n${repair}${manager ? `\nOptional features: ${health.optional.length ? `missing ${health.optional.join(', ')} (reactions/cleanup only)` : 'reactions and cleanup available'}.${delivery ? `\nNotices: ${delivery}` : ''}\nBot readiness does not verify member access or team-only channel visibility.` : ''}`;
}
const managerSteps = '**Set up / add a channel team**\n1. Choose existing roles (e.g. squad and mod), or create/assign them in Discord. With take-turn rules, at least two humans across all allowed roles are needed.\n2. Create/select a dedicated text channel. Grant participating roles View Channel, Read Message History, and Send Messages. For private access check other overrides; owners/admins bypass restrictions, so test as ordinary members.\n3. Give Soulbot those same three permissions. Add Reactions enables check marks; Manage Messages enables cleanup.\n4. In the channel, run `/counting setup role:…` with the first role. Preview/confirm defaults: take turns; wrong numbers keep progress. Then `/counting role-add role:…` for each additional role, up to 10 total. `/counting role-remove role:…` removes eligibility; /counting settings lists it.\n5. Check /counting status, post the channel guide, and test 1 then 2 as two ordinary members. Repeat in another channel: the same roles can participate there too. Compare channel teams with /counting leaderboard.\nEach channel has one pooled count and contributor board. Multiple matching roles never give extra turns or credit. Role edits preserve progress/totals. Setup assigns no roles or permissions. If you cannot create resources, ask an administrator; bot readiness does not verify member access.';

function guide(game, roles) {
    return `**This channel is one counting team**\nAllowed roles (any one): ${roleLabel(game, roles)}\nMembers need any listed role and channel send access. The count is shared across all of them.\n${rules(game)}\nPost numbers only. ✅ means accepted; invalid posts may be removed.\nUse /counting current for the next number and your turn; /counting settings for current rules.\nOffline numbers may be missed. Edits/deletions do not undo accepted counts.\nGuide posted <t:${Math.floor(Date.now() / 1000)}:f>; rules may change.`;
}
function rejection(result) {
    const { game, outcome } = result;
    const expected = next(game);
    return {
        ineligible: `You need any one allowed role to count here: ${rolesOf(game).map(id => `<@&${id}>`).join(', ')}. Ask a server manager for a role.`,
        format: `Numbers only (no text/images/expressions). Expected **${expected}**. Your post was not counted; progress stays at **${game.current_count}**.`,
        alternation: `You counted last. Another teammate must post **${expected}**. Progress stays at **${game.current_count}**.`,
        wrong: `Expected **${expected}**. Your number was not counted; progress stays at **${game.current_count}**. Check /counting current for your turn.`,
        reset: 'Wrong number. Count restarted. Next: **1**. Any eligible teammate may begin.',
        paused: 'Counting is paused. Your number was not counted. Ask a manager to use /counting resume.',
        suspended: 'Counting needs repair. Your number was not counted. Ask a manager to check /counting status.',
        limit: 'Count limit reached. Ask a manager to use /counting reset.',
    }[outcome] || 'This game is retired. Normal chat is allowed.';
}
module.exports = { safe, roleLabel, stateLabel, next, nextNumberSentence, rules, participation, availability, readView, managerSteps, guide, example, rejection };
