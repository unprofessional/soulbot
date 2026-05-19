const { SlashCommandBuilder } = require('discord.js');
const {
    getHilariousEmojiDisplay,
    getHilariousLeaderboard,
} = require('../../features/reactions/hilarious_reacts.js');

function formatDeletedUser(entry) {
    const username = entry.lastKnownUser?.username;
    const displayName = entry.lastKnownUser?.displayName || entry.lastKnownUser?.globalName;

    if (username && displayName && displayName !== username) {
        return `\`${username}\` / ${displayName} (deleted acc)`;
    }

    if (username || displayName) {
        return `\`${username || displayName}\` (deleted acc)`;
    }

    return `<@${entry.memberId}>`;
}

async function formatLeaderboardUser(interaction, entry) {
    const user = await interaction.client?.users?.fetch?.(entry.memberId, { force: true }).catch(() => null);
    if (user) return `<@${entry.memberId}>`;

    return formatDeletedUser(entry);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('react-leaderboard')
        .setDescription('Show the top 10 members by :hilarious: reacts received.')
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply();

        const leaderboard = await getHilariousLeaderboard(interaction.guildId, 10);
        const emojiDisplay = getHilariousEmojiDisplay(interaction.guild);
        if (leaderboard.length === 0) {
            return interaction.editReply(`No one has received any ${emojiDisplay} reacts yet.`);
        }

        const renderedUsers = await Promise.all(
            leaderboard.map((entry) => formatLeaderboardUser(interaction, entry))
        );
        const lines = leaderboard.map((entry, index) => (
            `${index + 1}. ${renderedUsers[index]} - ${entry.total}`
        ));

        return interaction.editReply(
            `Top ${emojiDisplay} leaderboard\n${lines.join('\n')}`
        );
    },

    formatDeletedUser,
    formatLeaderboardUser,
};
