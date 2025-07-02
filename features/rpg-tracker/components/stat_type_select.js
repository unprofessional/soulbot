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
                label: 'Number (ex. Level, EXP, Gold, Agility, etc)',
                value: 'number',
                emoji: '🔢',
            },
            {
                label: 'Count (ex. HP, MP — current/max)',
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
