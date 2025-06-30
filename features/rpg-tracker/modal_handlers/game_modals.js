// features/rpg-tracker/modal_handlers/game_modals.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { updateGame } = require('../../../store/services/game.service');

/**
 * Handles modals related to game editing.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    if (customId.startsWith('editGameModal:')) {
        const [, gameId] = customId.split(':');

        try {
            const name = interaction.fields.getTextInputValue('name')?.trim();
            const description = interaction.fields.getTextInputValue('description')?.trim();

            if (!name || name.length > 100) {
                return interaction.reply({
                    content: '⚠️ Invalid game name. Please keep it under 100 characters.',
                    ephemeral: true,
                });
            }

            const game = await updateGame(gameId, { name, description });

            const defineStatsBtn = new ButtonBuilder()
                .setCustomId(`defineStats:${game.id}`)
                .setLabel('Define Required Stats')
                .setStyle(ButtonStyle.Primary);

            const publishBtn = new ButtonBuilder()
                .setCustomId(`publishGame:${game.id}`)
                .setLabel('📣 Publish Game')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(
                defineStatsBtn,
                publishBtn
            );

            return interaction.reply({
                content: `🛠️ Game updated to **${game.name}**.`,
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in editGameModal:', err);
            return interaction.reply({
                content: '❌ Failed to update game.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
