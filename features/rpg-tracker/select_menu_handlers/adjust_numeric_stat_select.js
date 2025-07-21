// features/rpg-tracker/select_menu_handlers/adjust_numeric_stat_select.js

const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

/**
 * Handles both:
 * - adjustStatSelect:<characterId> → new flow with delta input modal
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const [selected] = values;
    const [, statId] = selected.split(':');
    const [, characterId] = customId.split(':');

    const character = await getCharacterWithStats(characterId);
    const stat = character?.stats.find(s => s.template_id === statId);

    if (!character || !stat) {
        return await interaction.update({
            content: '❌ Character or stat not found.',
            embeds: [],
            components: [],
        });
    }

    // === Show modal input for count/number fields
    if (customId.startsWith('adjustStatSelect:')) {
        const modal = new ModalBuilder()
            .setCustomId(`adjustStatModal:${characterId}:${statId}`)
            .setTitle(`Adjust Stat Value`);

        const operatorInput = new TextInputBuilder()
            .setCustomId('deltaOperator')
            .setLabel('Math operator (+, -, *, /)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('+');

        const valueInput = new TextInputBuilder()
            .setCustomId('deltaValue')
            .setLabel('Value to apply with operator')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter a number');

        modal.addComponents(
            new ActionRowBuilder().addComponents(operatorInput),
            new ActionRowBuilder().addComponents(valueInput)
        );

        return await interaction.showModal(modal);
    }

    // fallback (shouldn't happen)
    return await interaction.reply({
        content: '❌ Unknown stat adjustment selection.',
        ephemeral: true,
    });
}

module.exports = { handle };
