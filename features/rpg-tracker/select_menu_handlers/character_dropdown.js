// features/rpg-tracker/select_menu_handlers/character_dropdown.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

/**
 * Truncates a string to a maximum length, appending ellipsis if necessary.
 * Used to comply with Discord limits (e.g. 45 for titles/labels).
 * @param {string} str - The string to truncate.
 * @param {number} maxLength - Maximum allowed length.
 * @returns {string}
 */
function truncate(str, maxLength = 45) {
    return str.length > maxLength ? str.slice(0, maxLength - 3) + '...' : str;
}

/**
 * Handles character dropdown menus.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const selected = values?.[0];

    if (!selected) {
        return await interaction.reply({
            content: '⚠️ No selection made.',
            ephemeral: true,
        });
    }

    // === /create-character dropdown ===
    if (['createCharacterDropdown', 'editCharacterFieldDropdown'].includes(customId)) {
        console.log('[CreateCharacterDropdown] raw selected value:', selected);
        const [selectedField, rawLabel, fieldType] = selected.split('|');
        const label = rawLabel || selectedField;

        console.log('[CreateCharacterDropdown] parsed fieldKey:', selectedField);
        console.log('[CreateCharacterDropdown] parsed label:', label);
        console.log('[CreateCharacterDropdown] fieldType:', fieldType);

        if (!selectedField.includes(':')) {
            console.warn('[CreateCharacterDropdown] Invalid fieldKey:', selectedField);
            return await interaction.reply({
                content: '⚠️ Invalid field selected. Please run `/create-character` again.',
                ephemeral: true,
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`createDraftCharacterField:${selectedField}|${label}|${fieldType || ''}`)
            .setTitle(truncate(`Enter value for ${label}`, 45));

        if (fieldType === 'count') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`${selectedField}:max`)
                        .setLabel(truncate(`MAX value for ${label}`, 45))
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`${selectedField}:current`)
                        .setLabel(truncate(`CURRENT (optional)`, 45))
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                )
            );
        } else {
            const inputStyle = selectedField === 'core:bio'
                ? TextInputStyle.Paragraph
                : TextInputStyle.Short;

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(selectedField)
                        .setLabel(truncate(`Value for ${label}`, 45))
                        .setStyle(inputStyle)
                        .setRequired(true)
                )
            );
        }

        return await interaction.showModal(modal);
    }

}

module.exports = { handle };
