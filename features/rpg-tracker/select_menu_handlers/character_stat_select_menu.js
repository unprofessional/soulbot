// features/rpg-tracker/select_menu_handlers/character_stat_select_menu.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

/**
 * Shows stat edit modal after user selects a stat from dropdown.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const [, characterId] = customId.split(':');
    const statName = values?.[0];

    const character = await getCharacterWithStats(characterId);
    const stat = character.stats.find(s => s.name === statName);

    if (!stat) {
        return await interaction.reply({
            content: '❌ Stat not found.',
            ephemeral: true,
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`editStatModal:${characterId}:${statName}`)
        .setTitle(`Edit Stat: ${stat.label || statName}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('statValue')
                    .setLabel('New Value')
                    .setStyle(TextInputStyle.Short)
                    .setValue(stat.value?.toString() || '')
                    .setRequired(true)
            )
        );

    return await interaction.showModal(modal);
}

module.exports = { handle };
