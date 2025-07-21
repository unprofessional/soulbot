// commands/global/rpg-tracker/view-game.js

const { SlashCommandBuilder } = require('discord.js');
const { getCurrentGame } = require('../../../store/services/player.service');
const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { build } = require('../../../features/rpg-tracker/components/view_game_card');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-game')
        .setDescription('View your currently active game.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ You must use this command in a server.',
                ephemeral: true,
            });
        }

        try {
            const currentGameId = await getCurrentGame(userId, guildId);

            if (!currentGameId) {
                return await interaction.reply({
                    content: '⚠️ You do not have an active game in this server. Use `/switch-game` to select one.',
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

            const statTemplates = await getStatTemplates(currentGameId);
            const response = build(game, statTemplates, userId);

            return await interaction.reply({
                ...response,
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
