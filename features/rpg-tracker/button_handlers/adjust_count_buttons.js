// features/rpg-tracker/button_handlers/adjust_count_buttons.js

const { getCharacterWithStats } = require('../../../store/services/character.service');
const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

/**
 * Handles adjust count button (➕/➖ Adjust Stats)
 */
async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');

    const character = await getCharacterWithStats(characterId);
    if (!character) {
        return await interaction.reply({
            content: '⚠️ Character not found.',
            ephemeral: true,
        });
    }

    // Filter count-type stats
    const countStats = character.stats.filter(s => s.field_type === 'count');
    if (countStats.length === 0) {
        return await interaction.reply({
            content: '⚠️ This character has no count-type stats to adjust.',
            ephemeral: true,
        });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`adjustCountSelect:${characterId}`)
        .setPlaceholder('Choose a stat to adjust')
        .addOptions(
            countStats.map(stat => ({
                label: stat.label,
                value: `adjust:${stat.template_id}`, // could also encode stat id or label if preferred
                description: `Current: ${stat.meta?.current ?? stat.meta?.max ?? '??'} / ${stat.meta?.max ?? '??'}`,
            }))
        );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
        content: `Select a stat to adjust.`,
        components: [row],
        ephemeral: true,
    });
}

module.exports = { handle };
