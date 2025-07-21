// features/rpg-tracker/components/edit_stat_selector.js

const {
    getStatTemplates,
} = require('../../../store/services/game.service');

const { buildStatTemplateModal } = require('../modal_handlers/stat_template_modals');

const id = 'editStatSelect';

/**
 * Build the select menu row to edit a stat.
 * @param {string} gameId
 * @param {Array<Object>} statTemplates
 * @returns {import('discord.js').ActionRowBuilder}
 */
function build(gameId, statTemplates) {
    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

    const options = statTemplates.map((f, i) => ({
        label: `${i + 1}. ${f.label}`,
        description: `Type: ${f.field_type} — Default: ${f.default_value || 'None'}`,
        value: f.id,
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setPlaceholder('Select a stat field to edit')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Handle the select interaction for editing stat templates.
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
        console.error('[editStatSelect] Error showing modal:', err);
        return await interaction.reply({
            content: '❌ Failed to show edit modal.',
            ephemeral: true,
        });
    }
}

module.exports = {
    id,
    build,
    handle,
};
