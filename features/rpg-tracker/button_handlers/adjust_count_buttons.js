// features/rpg-tracker/button_handlers/adjust_count_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { renderCharacterView } = require('../utils/render_character_view');

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
        return await interaction.update(renderCharacterView(character));
    }

    const options = countStats.map(stat => ({
        label: stat.label,
        value: `adjust:${stat.template_id}`,
        description: `Current: ${stat.meta?.current ?? stat.meta?.max ?? '??'} / ${stat.meta?.max ?? '??'}`,
    }));

    const dropdown = new StringSelectMenuBuilder()
        .setCustomId(`adjustCountSelect:${characterId}`)
        .setPlaceholder('Select a stat to adjust')
        .addOptions(options);

    const dropdownRow = new ActionRowBuilder().addComponents(dropdown);

    const base = renderCharacterView(character);

    return await interaction.update({
        ...base,
        content: '➕/➖ Select the stat you want to adjust:',
        components: [...base.components, dropdownRow],
    });
}

module.exports = { handle };
