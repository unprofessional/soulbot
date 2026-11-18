const { SlashCommandBuilder, ChannelType } = require('discord.js');
const ui = require('../../features/counting/ui.js');
const descriptions = {
    help: 'Find your teams, learn to play, or set up a competition.',
    current: 'See the next number and whether it is your turn.',
    settings: 'Read this team’s rules and learn how to change them.',
    status: 'Check whether counting works and how to fix a problem.',
    setup: 'Start a team game here using the default rules; preview before activation.',
    configure: 'Change counting rules; omitted options keep current settings.',
    'role-add': 'Allow another role to count here (maximum 10); progress stays.',
    'role-remove': 'Remove an allowed role here; keep at least one. Progress stays.',
    pause: 'Stop counting temporarily while keeping progress.',
    resume: 'Continue a saved game after checking its role and access.',
    reset: 'Preview restarting at 1; best count and lifetime totals stay.',
    retire: 'Preview removing this game from standings; history stays.',
    leaderboard: 'Compare the current counts and records of teams you can read.',
    top: 'See who posted the most accepted numbers in a channel.',
};
const data = new SlashCommandBuilder().setName('counting').setDescription('Find a team, count together, and manage counting games.').setDMPermission(false);
for (const [action, description] of Object.entries(descriptions)) {
    data.addSubcommand(sub => {
        sub.setName(action).setDescription(description);
        if (['setup', 'role-add', 'role-remove'].includes(action)) return sub.addRoleOption(o => o.setName('role').setDescription('Existing role allowed to count here; members must already hold it.').setRequired(true));
        if (action !== 'leaderboard') sub.addChannelOption(o => o.setName('channel').setDescription('Counting text channel; leave empty to use this channel.').addChannelTypes(ChannelType.GuildText));
        if (['help', 'leaderboard', 'top'].includes(action)) sub.addIntegerOption(o => o.setName('page').setDescription(action === 'help' ? 'Your teams page (5 per page); default 1.' : 'Results page (10 per page); default 1.').setMinValue(1).setMaxValue(1000000));
        if (action === 'top') sub.addStringOption(o => o.setName('scope').setDescription('Default: all accepted contributions for the current team history.').addChoices({ name: 'All team history (survives ordinary resets)', value: 'lifetime' }, { name: 'Since the last restart at 1 (current run)', value: 'run' }));
        if (action === 'configure') {
            sub.addStringOption(o => o.setName('mistakes').setDescription('Wrong-number behavior; leave empty to keep the current rule.').addChoices({ name: 'Keep progress on wrong numbers', value: 'reject' }, { name: 'Restart at 1 on a wrong number', value: 'reset' }));
            sub.addBooleanOption(o => o.setName('consecutive').setDescription('True: allow consecutive turns. False: teammates take turns.'));
        }
        return sub;
    });
}
module.exports = { data, execute: ui.execute };
