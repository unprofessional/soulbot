// features/rpg-tracker/button_handlers/game_buttons.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getOrCreatePlayer } = require('../../../store/services/player.service');
const {
    toggleGameVisibility,
    getStatTemplates,
    // getGame,
} = require('../../../store/services/game.service');

const {
    rebuildCreateGameResponse,
} = require('../utils/rebuild_create_game_response');

/**
 * Handles game management buttons (edit, toggle publish).
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === Edit Game Modal ===
    if (customId.startsWith('editGameModal:')) {
        const [, gameId] = customId.split(':');

        const modal = new ModalBuilder()
            .setCustomId(`editGameModal:${gameId}`)
            .setTitle('Edit Game Details')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel('Game Name')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('description')
                        .setLabel('Game Description')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                )
            );

        return await interaction.showModal(modal);
    }

    // === Toggle Game Visibility (Publish/Unpublish) ===
    if (customId.startsWith('togglePublishGame:')) {
        const [, gameId] = customId.split(':');

        try {
            const guildId = interaction.guild?.id;
            const userId = interaction.user.id;

            const player = await getOrCreatePlayer(userId, guildId);
            if (player?.role !== 'gm' || player.current_game_id !== gameId) {
                return await interaction.reply({
                    content: '⚠️ Only the GM of this game can toggle visibility.',
                    ephemeral: true,
                });
            }

            const updatedGame = await toggleGameVisibility(gameId);
            const statTemplates = await getStatTemplates(gameId);
            const response = rebuildCreateGameResponse(updatedGame, statTemplates);

            await interaction.update(response);

        } catch (err) {
            console.error('Error toggling game visibility:', err);
            return await interaction.reply({
                content: '❌ Failed to toggle visibility. Please try again later.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
