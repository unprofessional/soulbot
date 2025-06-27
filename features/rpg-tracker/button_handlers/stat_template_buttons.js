// features/rpg-tracker/button_handlers/stat_template_buttons.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getStatTemplates, getGame } = require('../../../store/services/game.service');

const {
    buildGameStatTemplateEmbed,
    buildGameStatActionRow,
} = require('../embeds/game_stat_embed');

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
        const [, gameId] = customId.split(':');

        try {
            const [game, stats] = await Promise.all([
                getGame({ id: gameId }),
                getStatTemplates(gameId),
            ]);

            if (!game) {
                return await interaction.reply({
                    content: '❌ Game not found. You may need to recreate it.',
                    ephemeral: true,
                });
            }

            // Build new embed and buttons
            const newEmbed = buildGameStatTemplateEmbed(stats, game);
            const newButtons = buildGameStatActionRow(gameId);

            await interaction.deferUpdate();
            await interaction.editReply({
                embeds: [newEmbed],
                components: [newButtons],
            });

        } catch (err) {
            console.error('Error in finishStatSetup:', err);
            return await interaction.reply({
                content: '❌ Something went wrong while finalizing your game setup.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
