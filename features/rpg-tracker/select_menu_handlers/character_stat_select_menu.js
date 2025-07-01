// features/rpg-tracker/select_menu_handlers/character_stat_select_menu.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

/**
 * Truncates a string to a max length for modal titles and labels.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncate(str, max = 45) {
    return str.length > max ? str.slice(0, max - 3) + '…' : str;
}

/**
 * Handles stat dropdown selection to open modal for stat editing.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const [, characterId] = customId.split(':');
    const selectedKey = values?.[0];

    const character = await getCharacterWithStats(characterId);

    // Find stat by name, template_id, or hybrid identifier
    const stat = (character.stats || []).find(s =>
        s.name === selectedKey ||
        s.template_id === selectedKey ||
        `${s.source}:${s.name}` === selectedKey
    );

    if (!stat) {
        console.warn('[editStatSelect] Stat not found for:', selectedKey, character.stats);
        return await interaction.reply({
            content: '❌ Stat not found.',
            ephemeral: true,
        });
    }

    const label = stat.label || stat.name || stat.template_id || 'Stat';
    const value = stat.value?.toString() || '';

    const modal = new ModalBuilder()
        .setCustomId(`editStatModal:${characterId}:${selectedKey}`)
        .setTitle(truncate(`Edit Stat: ${label}`))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('statValue')
                    .setLabel(truncate(`New value for ${label}`))
                    .setStyle(TextInputStyle.Short)
                    .setValue(value)
                    .setRequired(true)
            )
        );

    return await interaction.showModal(modal);
}

module.exports = { handle };
