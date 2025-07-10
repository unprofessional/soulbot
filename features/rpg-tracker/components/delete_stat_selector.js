// features/rpg-tracker/components/delete_stat_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getStatTemplateById,
} = require('../../../store/services/game.service');

const { build: buildCancelButton } = require('./finish_stat_setup_button');

const id = 'deleteStatSelect';

function build(gameId, statTemplates) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setPlaceholder('Select a stat field to delete')
        .addOptions(statTemplates.map((f, i) => ({
            label: `${i + 1}. ${f.label}`,
            description: `Type: ${f.field_type}`,
            value: f.id,
        })));

    return new ActionRowBuilder().addComponents(selectMenu);
}

async function handle(interaction) {
    const { customId, values } = interaction;
    const selected = values?.[0];
    const [, gameId] = customId.split(':');

    if (!selected) {
        return await interaction.reply({
            content: '⚠️ No field selected.',
            ephemeral: true,
        });
    }

    try {
        const field = await getStatTemplateById(selected);
        if (!field || field.game_id !== gameId) {
            return await interaction.reply({
                content: '❌ Could not find or verify the selected stat field.',
                ephemeral: true,
            });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirmDeleteStat:${selected}`)
                .setLabel('✅ Confirm Delete')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder(buildCancelButton(gameId))
        );

        return await interaction.update({
            content: `🗑️ Are you sure you want to delete stat **${field.label}**?`,
            embeds: [],
            components: [confirmRow],
        });
    } catch (err) {
        console.error('Error selecting stat field to delete:', err);
        return await interaction.reply({
            content: '❌ Failed to prepare delete confirmation.',
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
