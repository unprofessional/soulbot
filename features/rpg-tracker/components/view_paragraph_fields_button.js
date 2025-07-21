// features/rpg-tracker/components/view_paragraph_fields_button.js

const { ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCharacterWithStats } = require('../../../store/services/character.service');
const { build: buildParagraphFieldDropdown } = require('./paragraph_field_selector');

const id = 'viewParagraphFields';

/**
 * Builds the "📜 View Full Descriptions" button.
 */
function build(characterId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${characterId}`)
        .setLabel('📜 View Full Descriptions')
        .setStyle(ButtonStyle.Secondary);
}

/**
 * Handles the button interaction and presents a dropdown of long-form fields.
 */
async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');

    const character = await getCharacterWithStats(characterId);
    if (!character) {
        return await interaction.reply({
            content: '❌ Character not found.',
            ephemeral: true,
        });
    }

    const dropdownRow = buildParagraphFieldDropdown(character);
    if (!dropdownRow) {
        return await interaction.reply({
            content: 'ℹ️ No long-form descriptions available.',
            ephemeral: true,
        });
    }

    return await interaction.reply({
        content: '📜 *Select a long-form field below to view its full content.*',
        components: [dropdownRow],
        ephemeral: true,
    });
}

module.exports = { id, build, handle };
