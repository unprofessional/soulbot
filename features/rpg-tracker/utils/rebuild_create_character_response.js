// features/rpg-tracker/utils/rebuild_create_character_response.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

/**
 * Constructs the character creation content message.
 * @param {Object} game - Game object
 * @param {Array<Object>} statTemplates - Stat fields defined by GM
 * @param {Array<Object>} [userFields=[]] - User-defined reusable stat fields
 * @returns {string}
 */
function buildCreateCharacterMessage(game, statTemplates = [], userFields = []) {
    const lines = [];

    lines.push(`# 🧬 Create Character for **${game.name}**`);
    if (game.description?.trim()) {
        const desc = game.description.trim().slice(0, 200);
        lines.push(`> ${desc}${game.description.length > 200 ? '…' : ''}`);
    }

    lines.push('');
    lines.push(`**Included Fields:**`);
    lines.push(`- [CORE] Name`);
    lines.push(`- [CORE] Avatar URL`);
    lines.push(`- [CORE] Bio`);
    lines.push(`- [CORE] Visibility`);
    lines.push('');

    if (statTemplates.length) {
        lines.push(`**Game Fields:**`);
        for (const t of statTemplates) {
            lines.push(`- [GAME] ${t.label}`);
        }
    } else {
        lines.push(`🟨 _GM has not defined any game stat fields yet._`);
    }

    if (userFields.length) {
        lines.push('');
        lines.push(`**[USER] Custom Fields:**`);
        for (const f of userFields) {
            lines.push(`- [USER] ${f.label || f.name}`);
        }
    }

    lines.push('');
    lines.push(`Use the dropdown below to select a field to fill out.`);

    return lines.join('\n');
}

/**
 * Rebuilds the character creation message with dropdown and buttons.
 * @param {Object} game
 * @param {Array<Object>} statTemplates
 * @param {Array<Object>} userFields
 * @param {Array<{ name: string, label: string }>} fieldOptions
 * @returns {{ content: string, components: ActionRowBuilder[], embeds: [] }}
 */
function rebuildCreateCharacterResponse(game, statTemplates, userFields, fieldOptions) {
    const content = buildCreateCharacterMessage(game, statTemplates, userFields);

    const dropdown = new StringSelectMenuBuilder()
        .setCustomId('createCharacterDropdown')
        .setPlaceholder('Choose a character field to define')
        .addOptions(
            fieldOptions.map(f => ({
                label: f.label,
                value: `${f.name}|${f.label}`,
            }))
        );

    const dropdownRow = new ActionRowBuilder().addComponents(dropdown);

    const finalizeButton = new ButtonBuilder()
        .setCustomId('finalizeCharacter')
        .setLabel('✅ Finalize Character')
        .setStyle(ButtonStyle.Success);

    const buttonRow = new ActionRowBuilder().addComponents(finalizeButton);

    return {
        content,
        components: [dropdownRow, buttonRow],
        embeds: [],
    };
}

module.exports = {
    rebuildCreateCharacterResponse,
};
