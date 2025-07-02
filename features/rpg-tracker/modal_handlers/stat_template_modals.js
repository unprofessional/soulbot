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

    // === GM Create Stat via DROPDOWN flow ===
    if (customId.startsWith('createStatModal:')) {
        const [, gameId, fieldType] = customId.split(':');

        const label = interaction.fields.getTextInputValue('label')?.trim().toUpperCase();
        const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim() || null;
        const sortIndexRaw = interaction.fields.getTextInputValue('sort_index')?.trim();
        const sortIndex = sortIndexRaw ? parseInt(sortIndexRaw, 10) : null;

        if (!label || !['number', 'count', 'text-short', 'text-paragraph'].includes(fieldType)) {
            return await interaction.reply({
                content: '⚠️ Invalid input or stat type.',
                ephemeral: true,
            });
        }

        await addStatTemplates(gameId, [{
            label,
            field_type: fieldType,
            default_value: defaultValue,
            sort_index: sortIndex,
        }]);

        const [game, statTemplates] = await Promise.all([
            getGame({ id: gameId }),
            getStatTemplates(gameId),
        ]);

        const response = rebuildCreateGameResponse(game, statTemplates, label);

        return await interaction.update(response);
    }

    // === GM Edit Existing Stat Field === (no longer allows editing type)
    if (customId.startsWith('editStatTemplateModal:')) {
        const [, statId] = customId.split(':');

        try {
            const label = interaction.fields.getTextInputValue('label')?.trim().toUpperCase();
            const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim();
            const sortOrderRaw = interaction.fields.getTextInputValue('sort_order')?.trim();
            const sortOrder = isNaN(parseInt(sortOrderRaw)) ? 0 : parseInt(sortOrderRaw, 10);

            if (!label) {
                return await interaction.reply({
                    content: '⚠️ Field label is required.',
                    ephemeral: true,
                });
            }

            await updateStatTemplate(statId, {
                label,
                default_value: defaultValue,
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
 * Builds a modal for stat template editing (type cannot be changed).
 * @param {Object} options
 * @param {string} options.gameId - Required for creation
 * @param {Object} [options.field] - Optional, for editing
 */
function buildStatTemplateModal({ gameId, field }) {
    const isEdit = !!field;
    const id = isEdit ? `editStatTemplateModal:${field.id}` : `createStatModal:${gameId}:${field.field_type}`;
    const title = isEdit
        ? `Edit Field: ${field.label}`
        : `Add New Stat Field`;

    const components = [
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
                .setCustomId('sort_order')
                .setLabel('Sort Order (lower = higher up)')
                .setStyle(TextInputStyle.Short)
                .setValue(field?.sort_order?.toString() || '0')
                .setRequired(false)
        )
    ];

    return new ModalBuilder()
        .setCustomId(id)
        .setTitle(title)
        .addComponents(...components);
}

module.exports = {
    handle,
    buildStatTemplateModal,
};
