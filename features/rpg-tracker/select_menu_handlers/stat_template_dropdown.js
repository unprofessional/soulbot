// features/rpg-tracker/select_menu_handlers/stat_template_dropdown.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getStatTemplates } = require('../../store/services/game.service');

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

        const modal = new ModalBuilder()
            .setCustomId(`editStatTemplateModal:${field.id}`)
            .setTitle('Edit Required Stat Field')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('label')
                        .setLabel('Field Label')
                        .setStyle(TextInputStyle.Short)
                        .setValue(field.label)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('default_value')
                        .setLabel('Default Value')
                        .setStyle(TextInputStyle.Short)
                        .setValue(field.default_value || '')
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_type')
                        .setLabel('Field Type ("short" or "paragraph")')
                        .setStyle(TextInputStyle.Short)
                        .setValue(field.field_type)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('sort_order')
                        .setLabel('Sort Order')
                        .setStyle(TextInputStyle.Short)
                        .setValue(field.sort_order?.toString() || '0')
                        .setRequired(false)
                )
            );

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
