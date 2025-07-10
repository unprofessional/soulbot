// features/rpg-tracker/components/character_field_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const id = 'createCharacterDropdown';

/**
 * Truncates a string for use in labels or titles.
 */
function truncate(str, max = 45) {
    return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

/**
 * Builds a dropdown menu of unfilled character fields.
 * @param {Array<Object>} fieldOptions - Safe user/core/game fields.
 * @param {Array<Object>} statTemplates - Game stat templates.
 */
function build(fieldOptions = [], statTemplates = []) {
    const dropdown = new StringSelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder('Choose a character field to define')
        .addOptions(
            fieldOptions.map(f => {
                const template = statTemplates.find(t => `game:${t.id}` === f.name);
                const fieldType = template?.field_type;
                return {
                    label: f.label,
                    value: `${f.name}|${f.label}${fieldType ? `|${fieldType}` : ''}`,
                };
            })
        );
    return new ActionRowBuilder().addComponents(dropdown);
}

/**
 * Handles user interaction with the character field selection dropdown.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { values } = interaction;
    const selected = values?.[0];

    if (!selected) {
        return interaction.reply({
            content: '⚠️ No selection made.',
            ephemeral: true,
        });
    }

    console.log('[character_field_selector] raw selected value:', selected);

    const [fieldKey, rawLabel, fieldType] = selected.split('|');
    const label = rawLabel || fieldKey;

    if (!fieldKey.includes(':')) {
        console.warn('[character_field_selector] Invalid fieldKey:', fieldKey);
        return interaction.reply({
            content: '⚠️ Invalid field selected. Please run `/create-character` again.',
            ephemeral: true,
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`createDraftCharacterField:${fieldKey}|${label}|${fieldType || ''}`)
        .setTitle(truncate(`Enter value for ${label}`));

    if (fieldType === 'count') {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(`${fieldKey}:max`)
                    .setLabel(truncate(`MAX value for ${label}`))
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(`${fieldKey}:current`)
                    .setLabel(truncate(`CURRENT (optional)`))
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
            )
        );
    } else {
        const inputStyle = fieldKey === 'core:bio' ? TextInputStyle.Paragraph : TextInputStyle.Short;

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(fieldKey)
                    .setLabel(truncate(`Value for ${label}`))
                    .setStyle(inputStyle)
                    .setRequired(true)
            )
        );
    }

    return interaction.showModal(modal);
}

module.exports = {
    id,
    build,
    handle,
};
