// features/rpg-tracker/select_menu_handlers/stat_template_dropdown.js

const { getStatTemplates } = require('../../../store/services/game.service');
const { buildStatTemplateModal } = require('../modal_handlers/stat_template_modals');

/**
 * Handles stat template field selection for editing.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, values } = interaction;
    const selected = values?.[0];

    if (!selected || !customId.startsWith('editStatSelect:')) {
        return await interaction.reply({
            content: '⚠️ No field selected or invalid menu.',
            ephemeral: true,
        });
    }

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

module.exports = { handle };
