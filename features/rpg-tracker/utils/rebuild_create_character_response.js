// features/rpg-tracker/utils/rebuild_create_character_response.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

/**
 * Truncates long field values for display (max 40 chars).
 */
function summarize(value, max = 40) {
    if (!value) return '';
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/**
 * Constructs the character creation content message.
 * @param {Object} game - Game object
 * @param {Array<Object>} statTemplates - Stat fields defined by GM
 * @param {Array<Object>} [userFields=[]] - User-defined reusable stat fields
 * @param {Object} [draftData={}] - In-memory draft data for current user
 * @returns {string}
 */
function buildCreateCharacterMessage(game, statTemplates = [], userFields = [], draftData = {}) {
    const lines = [];

    lines.push(`# 🧬 Create Character for **${game.name}**`);
    if (game.description?.trim()) {
        const desc = game.description.trim().slice(0, 200);
        lines.push(`> ${desc}${game.description.length > 200 ? '…' : ''}`);
    }

    lines.push('');
    lines.push(`**Included Fields:**`);

    const coreFields = [
        'core:name',
        'core:avatar_url',
        'core:bio',
        'core:visibility',
    ];

    for (const key of coreFields) {
        const value = draftData[key];
        const label = key.split(':')[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (value && value.toString().trim()) {
            lines.push(`- [CORE] ${label} 🟢 ${summarize(value.toString())}`);
        } else {
            lines.push(`- [CORE] ${label}`);
        }
    }

    lines.push('');

    if (statTemplates.length) {
        lines.push(`**Game Fields:**`);
        for (const t of statTemplates) {
            const key = `game:${t.id}`;
            const value = draftData[key];
            if (value && value.toString().trim()) {
                lines.push(`- [GAME] ${t.label} 🟢 ${summarize(value.toString())}`);
            } else {
                lines.push(`- [GAME] ${t.label}`);
            }
        }
    } else {
        lines.push(`🟨 _GM has not defined any game stat fields yet._`);
    }

    if (userFields.length) {
        lines.push('');
        lines.push(`**[USER] Custom Fields:**`);
        for (const f of userFields) {
            const key = `user:${f.name}`;
            const value = draftData[key];
            const label = f.label || f.name;
            if (value && value.toString().trim()) {
                lines.push(`- [USER] ${label} 🟢 ${summarize(value.toString())}`);
            } else {
                lines.push(`- [USER] ${label}`);
            }
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
 * @param {Array<{ name: string, label: string }>} fieldOptions - Remaining fields
 * @param {Object} [draftData={}] - All known draft values
 * @returns {{ content: string, components: ActionRowBuilder[], embeds: [] }}
 */
function rebuildCreateCharacterResponse(game, statTemplates, userFields, fieldOptions, draftData = {}) {
    const content = buildCreateCharacterMessage(game, statTemplates, userFields, draftData);

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
