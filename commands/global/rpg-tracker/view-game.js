const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCurrentGame } = require('../../../store/services/player.service');
const { getGame } = require('../../../store/services/game.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-game')
        .setDescription('View your currently active game.'),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const currentGameId = await getCurrentGame(userId);

            if (!currentGameId) {
                return await interaction.reply({
                    content: '⚠️ You do not have an active game. Use `/switch-game` to select one.',
                    ephemeral: true,
                });
            }

            const game = await getGame({ id: currentGameId });

            if (!game) {
                return await interaction.reply({
                    content: '⚠️ Your current game no longer exists.',
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎲 ${game.name}`)
                .setDescription(game.description || '*No description provided.*')
                .addFields(
                    { name: 'Game ID', value: game.id, inline: false },
                    { name: 'Visibility', value: game.is_public ? '🌐 Public' : '🔒 Private', inline: true }
                )
                .setFooter({ text: `Created by ${game.created_by}` })
                .setTimestamp(new Date(game.created_at));

            return await interaction.reply({
                embeds: [embed],
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in /view-game:', err);
            return await interaction.reply({
                content: '❌ Failed to retrieve current game.',
                ephemeral: true,
            });
        }
    },
};
