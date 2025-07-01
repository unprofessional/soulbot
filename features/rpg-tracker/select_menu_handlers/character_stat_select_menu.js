// features/rpg-tracker/select_menu_handlers/character_stat_select_menu.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

/**
 * Truncates a string to a maximum length with ellipsis if needed.
 */
function truncate(str, max = 45) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/**
 * Shows stat or core field edit modal after user selects from dropdown.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const [, characterId] = customId.split(':');
    const selectedKey = values?.[0];

    const character = await getCharacterWithStats(characterId);

    if (!selectedKey) {
        return await interaction.reply({
            content: '⚠️ No stat selected.',
            ephemeral: true,
        });
    }

    // === Handle CORE fields ===
    if (selectedKey.startsWith('core:')) {
        const [, coreField] = selectedKey.split(':');
        const value = character[coreField] ?? '';
        const label = coreField.charAt(0).toUpperCase() + coreField.slice(1);
        const inputStyle = coreField === 'bio' ? TextInputStyle.Paragraph : TextInputStyle.Short;

        const modal = new ModalBuilder()
            .setCustomId(`setCharacterField:${selectedKey}|${label}`)
            .setTitle(truncate(`Edit ${label}`))
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(selectedKey)
                        .setLabel(truncate(`Value for ${label}`))
                        .setStyle(inputStyle)
                        .setValue(value)
                        .setRequired(true)
                )
            );

        return await interaction.showModal(modal);
    }

    // === Handle template-defined or user-defined fields ===
    const stat = (character.stats || []).find(s =>
        s.template_id === selectedKey || s.name === selectedKey
    );

    if (!stat) {
        console.warn('[editStatSelect] Stat not found for:', selectedKey, character.stats);
        return await interaction.reply({
            content: '❌ Could not find that stat field.',
            ephemeral: true,
        });
    }

    const label = stat.label || selectedKey;
    const fieldKey = stat.template_id || stat.name;

    const inputStyle = (stat.field_type === 'paragraph' || stat.meta?.field_type === 'paragraph')
        ? TextInputStyle.Paragraph
        : TextInputStyle.Short;

    const modal = new ModalBuilder()
        .setCustomId(`editStatModal:${characterId}:${fieldKey}`)
        .setTitle(truncate(`Edit Stat: ${label}`))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('statValue')
                    .setLabel(truncate(`New value for ${label}`))
                    .setStyle(inputStyle)
                    .setValue(stat.value ?? '')
                    .setRequired(true)
            )
        );

    return await interaction.showModal(modal);
}

module.exports = { handle };
