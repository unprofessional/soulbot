// features/rpg-tracker/button_handlers/adjust_count_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');

const {
    getCharacterWithStats,
    updateStatMetaField,
} = require('../../../store/services/character.service');

const { renderCharacterView } = require('../utils/render_character_view');

async function handle(interaction) {
    const { customId } = interaction;

    // === Adjust Stats Main Button ===
    if (customId.startsWith('adjust_stats:')) {
        const [, characterId] = customId.split(':');
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

        const cancelButton = new ButtonBuilder()
            .setCustomId(`goBackToCharacter:${characterId}`)
            .setLabel('↩️ Cancel / Go Back')
            .setStyle(ButtonStyle.Secondary);

        const cancelRow = new ActionRowBuilder().addComponents(cancelButton);

        const base = renderCharacterView(character);

        return await interaction.update({
            ...base,
            content: '➕/➖ Select the stat you want to adjust:',
            components: [...base.components, dropdownRow, cancelRow],
        });
    }

    // === Stat Selection (Dropdown)
    if (customId.startsWith('adjustCountSelect:')) {
        const [, characterId] = customId.split(':');
        const [selected] = interaction.values;
        const [, statId] = selected.split(':');

        const character = await getCharacterWithStats(characterId);
        const stat = character?.stats.find(s => s.template_id === statId);

        if (!character || !stat || stat.field_type !== 'count') {
            return await interaction.update({
                content: '❌ Stat not found or not a count field.',
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

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`decrementCount:${characterId}:${statId}`)
                .setLabel('➖')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`incrementCount:${characterId}:${statId}`)
                .setLabel('➕')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`adjust_stats:${characterId}`)
                .setLabel('↩️ Back to Stat Select')
                .setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({
            content: `⚙️ Adjusting stat for **${character.name}**`,
            embeds: [embed],
            components: [row],
        });
    }

    // === Increment / Decrement Count
    if (
        customId.startsWith('incrementCount:') ||
        customId.startsWith('decrementCount:')
    ) {
        const [action, characterId, statId] = customId.split(':');
        const delta = action === 'incrementCount' ? 1 : -1;

        const character = await getCharacterWithStats(characterId);
        const stat = character?.stats.find(s => s.template_id === statId);

        if (!character || !stat || stat.field_type !== 'count') {
            return await interaction.update({
                content: '❌ Stat not found or not a count field.',
                embeds: [],
                components: [],
            });
        }

        const prev = stat.meta?.current ?? stat.meta?.max ?? 0;
        const max = stat.meta?.max ?? '?';
        const next = prev + delta;

        await updateStatMetaField(characterId, statId, 'current', next);

        const embed = new EmbedBuilder()
            .setTitle(`Adjust **${stat.label}**`)
            .setDescription(`Current Value: **${next} / ${max}**`)
            .setColor(0x00b0f4);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`decrementCount:${characterId}:${statId}`)
                .setLabel('➖')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`incrementCount:${characterId}:${statId}`)
                .setLabel('➕')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`adjust_stats:${characterId}`)
                .setLabel('↩️ Back to Stat Select')
                .setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({
            content: `⚙️ Adjusting stat for **${character.name}**`,
            embeds: [embed],
            components: [row],
        });
    }
}

module.exports = { handle };
