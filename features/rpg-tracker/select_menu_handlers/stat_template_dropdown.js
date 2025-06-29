// features/rpg-tracker/select_menu_handlers/stat_template_dropdown.js

const {
    getStatTemplates,
    getStatTemplateById,
} = require('../../../store/services/game.service');

const { buildStatTemplateModal } = require('../modal_handlers/stat_template_modals');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handles stat template field selection menus (edit and delete).
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const selected = values?.[0];

    if (!selected) {
        return await interaction.reply({
            content: '⚠️ No field selected.',
            ephemeral: true,
        });
    }

    // === Handle Edit Stat Select ===
    if (customId.startsWith('editStatSelect:')) {
        try {
            const [, gameId] = customId.split(':');
            const statTemplates = await getStatTemplates(gameId);
            const field = statTemplates.find(f => f.id === selected);

            if (!field) {
                return await interaction.reply({
                    content: '❌ Could not find that stat field.',
                    ephemeral: true,
                });
            }

            const modal = buildStatTemplateModal({ gameId, field });
            return await interaction.showModal(modal);
        } catch (err) {
            console.error('Error selecting stat field to edit:', err);
            return await interaction.reply({
                content: '❌ Failed to show edit modal.',
                ephemeral: true,
            });
        }
    }

    // === Handle Delete Stat Select (ask for confirmation) ===
    if (customId.startsWith('deleteStatSelect:')) {
        try {
            const [, gameId] = customId.split(':');

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
                new ButtonBuilder()
                    .setCustomId(`finishStatSetup:${gameId}`)
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Secondary)
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

    // === Fallback: No known customId matched
    return await interaction.reply({
        content: '❌ Unknown stat field menu interaction.',
        ephemeral: true,
    });
}

module.exports = { handle };
