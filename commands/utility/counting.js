const { SlashCommandBuilder, ChannelType, PermissionFlagsBits: P } = require('discord.js');
const service = require('../../features/counting/service.js');
const readActions = new Set(['status', 'current', 'settings', 'help']);
const data = new SlashCommandBuilder().setName('counting').setDescription('Role counting games').setDMPermission(false);
function channelOption(sub) {
    return sub.addChannelOption(o => o.setName('channel').setDescription('Counting channel (defaults to here)').addChannelTypes(ChannelType.GuildText).setRequired(sub.name === 'setup'));
}
for (const action of ['setup', 'configure', 'pause', 'resume', 'reset', 'retire', 'status', 'current', 'settings', 'help']) {
    data.addSubcommand(sub => {
        sub.setName(action).setDescription(`${action} a counting game`);
        channelOption(sub);
        if (['setup', 'configure'].includes(action)) {
            sub.addRoleOption(o => o.setName('role').setDescription('Team role').setRequired(action === 'setup'));
            sub.addStringOption(o => o.setName('mistakes').setDescription('Wrong-number policy').addChoices({ name: 'Reject; keep progress', value: 'reject' }, { name: 'Reset to zero', value: 'reset' }));
            sub.addBooleanOption(o => o.setName('consecutive').setDescription('Allow the same member to count twice in a row'));
            if (action === 'configure') sub.addStringOption(o => o.setName('history').setDescription('Required when changing roles').addChoices({ name: 'Retain history', value: 'retain' }, { name: 'Reset history', value: 'reset' }));
        }
        return sub;
    });
}
async function executeWork(i) {
    if (!i.guildId) return i.reply({ content: 'Use this command in a server.', ephemeral: true });
    const action = i.options.getSubcommand();
    const management = !readActions.has(action);
    if (management && !i.memberPermissions?.has(P.ManageGuild)) return i.reply({ content: 'You need Manage Server to manage counting games.', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    try {
        if (!service.isAvailable()) throw new Error('Counting is unavailable: schema initialization failed. Check bot logs.');
        const channel = i.options.getChannel('channel') || i.channel;
        if (!channel || channel.guildId !== i.guildId || channel.type !== ChannelType.GuildText) throw new Error('Choose a text channel in this server.');
        const viewer = await i.guild.members.fetch({ user: i.user.id, force: true });
        if (management && !viewer.permissions.has(P.ManageGuild)) throw new Error('You need Manage Server to manage counting games.');
        if (!channel.permissionsFor(viewer)?.has(P.ViewChannel)) throw new Error('You cannot view that channel.');
        if (action === 'help') return i.editReply('Use /counting setup to assign a team role. Members post the next plain whole number; another member must take the next turn by default. /counting current, status, and settings show progress and rules. Managers can configure, pause, resume, reset, or retire games. Defaults: mistakes preserve progress; one active channel per role. Text/images and expressions are not supported. Offline posts are ignored. Edits/deletions preserve recorded progress; visible restoration, rankings, and milestones are planned for later phases. Configure channel access manually.');
        let game = await service.dao.get(i.guildId, channel.id);
        if (readActions.has(action)) {
            if (!game) throw new Error('No counting game is configured here.');
            const role = await i.guild.roles.fetch(game.role_id);
            if (!role && game.state !== 'retired') {
                await service.dao.manage(i.guildId, channel.id, null, 'suspend');
                game = await service.dao.get(i.guildId, channel.id);
            }
            await i.guild.members.fetchMe();
            const health = service.diagnostics(channel, i.guild);
            return i.editReply({ content: `Count: ${game.current_count}; next: ${game.current_count === Number.MAX_SAFE_INTEGER ? 'limit reached' : game.current_count + 1}; record: ${game.record}.\nTeam: ${role ? `<@&${game.role_id}>` : 'Deleted role'}; state: ${game.state}.\nMistakes: ${game.mistake_policy}; consecutive turns: ${game.allow_consecutive ? 'allowed' : 'disabled'}.\nInput: integers only; text/images disabled. Offline submissions ignored.\nPermissions: ${health.required.length ? 'UNAVAILABLE: missing required channel permissions' : 'ready'}${health.optional.length ? '; reaction or cleanup permissions missing' : ''}.`, allowedMentions: { parse: [] } });
        }
        const role = ['setup', 'configure'].includes(action) ? i.options.getRole('role') : null;
        if (role && (role.guild?.id || role.guildId) !== i.guildId) throw new Error('Choose a role in this server.');
        if (['setup', 'configure', 'resume'].includes(action)) await service.validateTarget(i.guild, channel, role?.id || game?.role_id);
        await service.dao.manage(i.guildId, channel.id, i.user.id, action, {
            roleId: role?.id, policy: ['setup', 'configure'].includes(action) ? i.options.getString('mistakes') : null,
            consecutive: ['setup', 'configure'].includes(action) ? i.options.getBoolean('consecutive') : null,
            history: action === 'configure' ? i.options.getString('history') : null,
        });
        return i.editReply(`Counting ${action} completed for #${channel.name}.`);
    } catch (error) {
        console.error('[counting] Command failed:', error.message);
        return i.editReply(error.code === '23505' ? 'That channel or role already has a counting game. Retire the old role assignment first.' : error.message);
    }
}
module.exports = { data, execute: i => service.track(executeWork(i)) };
