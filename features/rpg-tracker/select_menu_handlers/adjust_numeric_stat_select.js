// features/rpg-tracker/select_menu_handlers/adjust_numeric_stat_select.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');

/**
 * Handles both:
 * - adjustCountSelect:<characterId> → legacy flow with increment/decrement buttons
 * - adjustStatSelect:<characterId> → new flow with delta input modal
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const [selected] = values;
    const [, statId] = selected.split(':');
    const [, characterId] = customId.split(':');

    const character = await getCharacterWithStats(characterId);
    const stat = character?.stats.find(s => s.template_id === statId);

    if (!character || !stat) {
        return await interaction.update({
            content: '❌ Character or stat not found.',
            embeds: [],
            components: [],
        });
    }

    // === NEW FLOW: show modal input for count/number fields
    if (customId.startsWith('adjustStatSelect:')) {
        const modal = new ModalBuilder()
            .setCustomId(`adjustStatModal:${characterId}:${statId}`)
            .setTitle(`Adjust Stat Value`);

        const deltaInput = new TextInputBuilder()
            .setCustomId('deltaValue')
            .setLabel('Amount to add or subtract (e.g. -2 or 5)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter a number');

        modal.addComponents(new ActionRowBuilder().addComponents(deltaInput));
        return await interaction.showModal(modal);
    }

    // === LEGACY FLOW: show increment/decrement buttons
    if (customId.startsWith('adjustCountSelect:')) {
        if (stat.field_type !== 'count') {
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

    // fallback (shouldn't happen)
    return await interaction.reply({
        content: '❌ Unknown stat adjustment selection.',
        ephemeral: true,
    });
}

module.exports = { handle };
