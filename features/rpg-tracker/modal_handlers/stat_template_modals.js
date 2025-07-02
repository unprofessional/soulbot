// features/rpg-tracker/modal_handlers/stat_template_modals.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const {
    addStatTemplates,
    getStatTemplates,
    updateStatTemplate,
    getGame,
    getStatTemplateById,
} = require('../../../store/services/game.service');

const {
    rebuildCreateGameResponse,
} = require('../utils/rebuild_create_game_response');

/**
 * Handles modals related to stat template creation and editing.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === GM Create DROPDOWN init Game Stats ===
    if (customId.startsWith('createStatModal:')) {
        const [, gameId, fieldType] = customId.split(':');

        const label = interaction.fields.getTextInputValue('label')?.trim();
        const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim() || null;
        const sortIndexRaw = interaction.fields.getTextInputValue('sort_index')?.trim();
        const sortIndex = sortIndexRaw ? parseInt(sortIndexRaw, 10) : null;

        if (!label || !['number', 'count', 'text-short', 'text-paragraph'].includes(fieldType)) {
            return await interaction.reply({
                content: '⚠️ Invalid input or stat type.',
                ephemeral: true,
            });
        }

        const newStat = await addStatTemplates(gameId, [{
            label,
            field_type: fieldType,
            default_value: defaultValue,
            sort_index: sortIndex,
        }]);

        const game = await getGame({ id: gameId });
        const statTemplates = await getStatTemplates(gameId);

        const response = rebuildCreateGameResponse(game, statTemplates, label);

        return await interaction.update(response);
    }

    // === GM Create Default Game Stat Field ===
    if (customId.startsWith('createStatTemplate:')) {
        const [, gameId] = customId.split(':');

        try {
            const label = interaction.fields.getTextInputValue('label')?.trim().toUpperCase();
            const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim() || null;
            const fieldType = interaction.fields.getTextInputValue('field_type')?.trim().toLowerCase();
            const sortOrderRaw = interaction.fields.getTextInputValue('sort_order')?.trim();
            const sortOrder = isNaN(parseInt(sortOrderRaw)) ? 0 : parseInt(sortOrderRaw, 10);

            if (!label || !['short', 'paragraph'].includes(fieldType)) {
                return await interaction.reply({
                    content: '⚠️ Please provide a valid label and field type ("short" or "paragraph").',
                    ephemeral: true,
                });
            }

            await addStatTemplates(gameId, [{
                label,
                field_type: fieldType,
                default_value: defaultValue,
                is_required: true,
                sort_order: sortOrder,
            }]);

            const [allFields, game] = await Promise.all([
                getStatTemplates(gameId),
                getGame({ id: gameId }),
            ]);

            const response = rebuildCreateGameResponse(game, allFields, label);

            await interaction.deferUpdate();
            await interaction.editReply(response);

        } catch (err) {
            console.error('Error in createStatTemplate modal:', err);
            return interaction.reply({
                content: '❌ Failed to add stat template. Please try again.',
                ephemeral: true,
            });
        }
    }

    // === GM Edit Existing Stat Field ===
    if (customId.startsWith('editStatTemplateModal:')) {
        const [, statId] = customId.split(':');

        try {
            const label = interaction.fields.getTextInputValue('label')?.trim().toUpperCase();
            const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim();
            const fieldType = interaction.fields.getTextInputValue('field_type')?.trim().toLowerCase();
            const sortOrderRaw = interaction.fields.getTextInputValue('sort_order')?.trim();
            const sortOrder = isNaN(parseInt(sortOrderRaw)) ? 0 : parseInt(sortOrderRaw, 10);

            if (!label || !['short', 'paragraph'].includes(fieldType)) {
                return await interaction.reply({
                    content: '⚠️ Invalid input. Field type must be `short` or `paragraph`.',
                    ephemeral: true,
                });
            }

            await updateStatTemplate(statId, {
                label,
                default_value: defaultValue,
                field_type: fieldType,
                sort_order: sortOrder,
            });

            const fieldRecord = await getStatTemplateById(statId);
            const gameId = fieldRecord?.game_id;

            if (!gameId) {
                return await interaction.reply({
                    content: '❌ Could not determine the game associated with this field.',
                    ephemeral: true,
                });
            }

            const [allFields, game] = await Promise.all([
                getStatTemplates(gameId),
                getGame({ id: gameId }),
            ]);

            const response = rebuildCreateGameResponse(game, allFields, label);

            await interaction.deferUpdate();
            await interaction.editReply(response);

        } catch (err) {
            console.error('Error in editStatTemplateModal:', err);
            return interaction.reply({
                content: '❌ Failed to update stat template.',
                ephemeral: true,
            });
        }
    }
}

/**
 * Builds a modal for stat template creation or editing.
 * @param {Object} options
 * @param {string} options.gameId - Required for creation
 * @param {Object} [options.field] - Optional, for editing
 */
function buildStatTemplateModal({ gameId, field }) {
    const isEdit = !!field;
    const id = isEdit ? `editStatTemplateModal:${field.id}` : `createStatTemplate:${gameId}`;
    const title = isEdit ? 'Edit Required Stat Field' : 'Add Required Stat Field';

    return new ModalBuilder()
        .setCustomId(id)
        .setTitle(title)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('label')
                    .setLabel('Field Label (e.g. HP, CLASS, STRENGTH)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(field?.label || '')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('default_value')
                    .setLabel('Default Value (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(field?.default_value || '')
                    .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('field_type')
                    .setLabel('Field Type: short (1-line) or paragraph')
                    .setStyle(TextInputStyle.Short)
                    .setValue(field?.field_type || 'short')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('sort_order')
                    .setLabel('Sort Order (lower = higher up)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(field?.sort_order?.toString() || '0')
                    .setRequired(false)
            )
        );
}

module.exports = {
    handle,
    buildStatTemplateModal,
};
