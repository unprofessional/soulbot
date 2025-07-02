const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

/**
 * Builds the "Add Stat" type selection dropdown
 * @param {string} gameId
 * @returns {ActionRowBuilder}
 */
function buildStatTypeDropdown(gameId) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`selectStatType:${gameId}`)
        .setPlaceholder('➕ Add a new stat field...')
        .addOptions([
            {
                label: 'Number (e.g., Gold, XP, Agility, etc)',
                value: 'number',
                emoji: '🔢',
            },
            {
                label: 'Count (e.g., HP with current/max)',
                value: 'count',
                emoji: '🔁',
            },
            {
                label: 'Text (one-line)',
                value: 'text-short',
                emoji: '💬',
            },
            {
                label: 'Text (multi-line/paragraph)',
                value: 'text-paragraph',
                emoji: '📝',
            },
        ]);

    return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
    buildStatTypeDropdown,
};
