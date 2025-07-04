// features/rpg-tracker/select_menu_handlers/adjust_count_select.js

const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    EmbedBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

async function handle(interaction) {
    const [selected] = interaction.values;
    const [, statId] = selected.split(':'); // value is like `adjust:<statId>`
    const [, characterId] = interaction.customId.split(':');

    const character = await getCharacterWithStats(characterId);
    if (!character) {
        return await interaction.update({
            content: '❌ Character not found.',
            embeds: [],
            components: [],
        });
    }

    const stat = character.stats.find(s => s.template_id === statId);
    if (!stat || stat.field_type !== 'count') {
        return await interaction.update({
            content: '❌ That stat is no longer valid or not a count field.',
            embeds: [],
            components: [],
        });
    }

    const current = stat.meta?.current ?? stat.meta?.max ?? 0;
    const max = stat.meta?.max ?? '?';

    const embed = new EmbedBuilder()
        .setTitle(`Adjust **${stat.label}**`)
        .setDescription(`Current Value: **${current} / ${max}**`)
        .setColor(0x00b0f4);

    const decrementBtn = new ButtonBuilder()
        .setCustomId(`decrementCount:${characterId}:${statId}`)
        .setLabel('➖')
        .setStyle(ButtonStyle.Danger);

    const incrementBtn = new ButtonBuilder()
        .setCustomId(`incrementCount:${characterId}:${statId}`)
        .setLabel('➕')
        .setStyle(ButtonStyle.Success);

    const goBackBtn = new ButtonBuilder()
        .setCustomId(`adjust_stats:${characterId}`)
        .setLabel('↩️ Back to Stat Select')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(
        decrementBtn,
        incrementBtn,
        goBackBtn
    );

    return await interaction.update({
        content: `⚙️ Adjusting stat for **${character.name}**`,
        embeds: [embed],
        components: [row],
    });
}

module.exports = { handle };
