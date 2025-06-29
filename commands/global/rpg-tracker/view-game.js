// commands/global/rpg-tracker/view-game.js

const { SlashCommandBuilder } = require('discord.js');
const { getCurrentGame } = require('../../../store/services/player.service');
const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { rebuildCreateGameResponse } = require('../../../features/rpg-tracker/utils/rebuild_create_game_response');

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
            const response = rebuildCreateGameResponse(game, statTemplates);

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
