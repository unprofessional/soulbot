// features/rpg-tracker/button_handlers/character_edit_buttons.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

/**
 * Handles character stat edit button interactions.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    if (!customId.startsWith('edit_stat:')) return;

    const [, characterId] = customId.split(':');

    const modal = new ModalBuilder()
        .setCustomId(`editStatModal:${characterId}`)
        .setTitle('Edit Character Stat')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('statName')
                    .setLabel('Stat Name (e.g., hp, vigor, ranged)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('statValue')
                    .setLabel('New Stat Value (integer)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );

    return await interaction.showModal(modal);
}

module.exports = { handle };
