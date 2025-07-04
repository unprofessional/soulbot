// features/rpg-tracker/button_handlers/adjust_count_buttons.js

const { getCharacterWithStats } = require('../../../store/services/character.service');

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');

    const character = await getCharacterWithStats(characterId);
    if (!character) {
        return await interaction.update({
            content: '⚠️ Character not found.',
            components: [],
        });
    }

    const countStats = character.stats.filter(s => s.field_type === 'count');
    if (countStats.length === 0) {
        return await interaction.update({
            content: '⚠️ This character has no count-type stats to adjust.',
            components: [],
        });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`adjustCountSelect:${characterId}`)
        .setPlaceholder('Choose a stat to adjust')
        .addOptions(
            countStats.map(stat => ({
                label: stat.label,
                value: `adjust:${stat.template_id}`,
                description: `Current: ${stat.meta?.current ?? stat.meta?.max ?? '??'} / ${stat.meta?.max ?? '??'}`,
            }))
        );

    const row = new ActionRowBuilder().addComponents(select);

    return await interaction.update({
        content: 'Select a stat to adjust:',
        components: [row],
        embeds: [], // clear embeds, optional
    });
}

module.exports = { handle };
