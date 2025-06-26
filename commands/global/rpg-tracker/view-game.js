// commands/global/rpg-tracker/view-game.js

const { SlashCommandBuilder } = require('discord.js');
const { getCurrentGame } = require('../../../store/services/player.service');
const { getGame } = require('../../../store/services/game.service');
const { getCharactersByGame } = require('../../../store/services/character.service');
const { buildGameEmbed } = require('../../../features/rpg-tracker/embed_utils');

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

            const characters = await getCharactersByGame(currentGameId);
            const embed = buildGameEmbed(game, characters);

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
