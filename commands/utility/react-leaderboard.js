const { SlashCommandBuilder } = require('discord.js');
const { getHilariousLeaderboard } = require('../../features/reactions/hilarious_reacts.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('react-leaderboard')
        .setDescription('Show the top 10 members by :hilarious: reacts received.')
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply();

        const leaderboard = await getHilariousLeaderboard(interaction.guildId, 10);
        if (leaderboard.length === 0) {
            return interaction.editReply('No one has received any :hilarious: reacts yet.');
        }

        const lines = leaderboard.map((entry, index) => (
            `${index + 1}. <@${entry.memberId}> - ${entry.total}`
        ));

        return interaction.editReply(
            `Top :hilarious: leaderboard\n${lines.join('\n')}`
        );
    },
};
