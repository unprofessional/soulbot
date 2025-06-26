// features/rpg-tracker/button_handlers/stat_template_buttons.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getStatTemplates } = require('../../store/services/game.service');

/**
 * Handles stat template-related button interactions.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === Define Required Stats Modal ===
    if (customId.startsWith('defineStats:')) {
        const [, gameId] = customId.split(':');

        const modal = new ModalBuilder()
            .setCustomId(`createStatTemplate:${gameId}`)
            .setTitle('Add Required Stat Field')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('label')
                        .setLabel('Field Label (e.g. HP, Class, Strength)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('default_value')
                        .setLabel('Default Value (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_type')
                        .setLabel('Field Type ("short" or "paragraph")')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('sort_order')
                        .setLabel('Sort Order (e.g. 0 = top, 100 = bottom)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                )
            );

        return await interaction.showModal(modal);
    }

    // === Edit Stat Template Modal ===
    if (customId.startsWith('edit_stat_template:')) {
        const [, statFieldId] = customId.split(':');

        const statTemplates = await getStatTemplates();
        const currentField = statTemplates.find(f => f.id === statFieldId);

        if (!currentField) {
            return await interaction.reply({
                content: '❌ Could not find stat template to edit.',
                ephemeral: true,
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`editStatTemplateModal:${statFieldId}`)
            .setTitle('Edit Required Stat Field')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('label')
                        .setLabel('Field Label')
                        .setStyle(TextInputStyle.Short)
                        .setValue(currentField.label)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('default_value')
                        .setLabel('Default Value')
                        .setStyle(TextInputStyle.Short)
                        .setValue(currentField.default_value || '')
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('field_type')
                        .setLabel('Field Type ("short" or "paragraph")')
                        .setStyle(TextInputStyle.Short)
                        .setValue(currentField.field_type)
                        .setRequired(true)
                )
            );

        return await interaction.showModal(modal);
    }

    // === Finish Stat Setup ===
    if (customId.startsWith('finishStatSetup:')) {
        return await interaction.reply({
            content: '🎯 Stat template setup complete! You can now invite players to join and create characters.',
            ephemeral: true,
        });
    }
}

module.exports = { handle };
