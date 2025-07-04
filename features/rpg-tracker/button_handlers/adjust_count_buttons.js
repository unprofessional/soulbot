// features/rpg-tracker/button_handlers/adjust_count_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { getCharacterWithStats } = require('../../../store/services/character.service');
const { rebuildCreateCharacterResponse } = require('../utils/rebuild_create_character_response');

async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');

    const character = await getCharacterWithStats(characterId);
    if (!character) {
        return await interaction.update({
            content: '⚠️ Character not found.',
            embeds: [],
            components: [],
        });
    }

    const countStats = character.stats.filter(s => s.field_type === 'count');

    if (!countStats.length) {
        return await interaction.update({
            content: '⚠️ This character has no count-type stats to adjust.',
            ...rebuildCreateCharacterResponse(character), // fallback to original view
        });
    }

    const options = countStats.map((stat, i) => ({
        label: stat.label,
        value: `adjust:${stat.template_id}`,
        description: `Current: ${stat.meta?.current ?? stat.meta?.max ?? '??'} / ${stat.meta?.max ?? '??'}`,
    }));

    const dropdown = new StringSelectMenuBuilder()
        .setCustomId(`adjustCountSelect:${characterId}`)
        .setPlaceholder('Select a stat to adjust')
        .addOptions(options);

    const dropdownRow = new ActionRowBuilder().addComponents(dropdown);

    return await interaction.update({
        content: `➕/➖ Select a stat to adjust for **${character.name}**`,
        embeds: [],
        components: [dropdownRow],
    });
}

module.exports = { handle };
