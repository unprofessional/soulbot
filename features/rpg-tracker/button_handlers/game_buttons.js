// features/rpg-tracker/button_handlers/game_buttons.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const {
    getStatTemplates,
    togglePublish,
    publishGame,
} = require('../../../store/services/game.service');

const { getOrCreatePlayer } = require('../../../store/services/player.service');
const { rebuildCreateGameResponse } = require('../utils/rebuild_create_game_response');

/**
 * Handles game management buttons (edit, publish).
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

    // === Publish Game ===
    if (customId.startsWith('publishGame:')) {
        const [, gameId] = customId.split(':');

        try {
            const guildId = interaction.guild?.id;
            const userId = interaction.user.id;

            console.log('[publishGame] userId:', userId);
            console.log('[publishGame] guildId:', guildId);

            const player = await getOrCreatePlayer(userId, guildId);

            console.log('[publishGame] player server link:', player);

            if (player?.role !== 'gm' || player.current_game_id !== gameId) {
                return await interaction.reply({
                    content: '⚠️ Only the GM of this game can publish it.',
                    ephemeral: true,
                });
            }

            const result = await publishGame(gameId);

            return await interaction.reply({
                content: `📣 Game **${result.name}** is now published! Players can now see and join it using \`/join-game\`.`,
                ephemeral: true,
            });

        } catch (err) {
            console.error('Error publishing game:', err);
            return await interaction.reply({
                content: '❌ Failed to publish game. Please try again later.',
                ephemeral: true,
            });
        }
    }

    // === Toggle Publish Game ===
    if (customId.startsWith('togglePublishGame:')) {
        const [, gameId] = customId.split(':');

        try {
            const guildId = interaction.guild?.id;
            const userId = interaction.user.id;

            const player = await getOrCreatePlayer(userId, guildId);

            if (player?.role !== 'gm' || player.current_game_id !== gameId) {
                return await interaction.reply({
                    content: '⚠️ Only the GM of this game can change its publish status.',
                    ephemeral: true,
                });
            }

            const updatedGame = await togglePublish(gameId);
            const statTemplates = await getStatTemplates(gameId);

            const rebuilt = rebuildCreateGameResponse(updatedGame, statTemplates);

            return await interaction.update(rebuilt);

        } catch (err) {
            console.error('Error toggling publish state:', err);
            return await interaction.reply({
                content: '❌ Failed to toggle publish state. Try again later.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
