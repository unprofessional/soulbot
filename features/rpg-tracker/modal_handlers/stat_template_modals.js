// features/rpg-tracker/modal_handlers/stat_template_modals.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');

const {
    addStatTemplates,
    getStatTemplates,
    updateStatTemplate,
} = require('../../store/services/game.service');

/**
 * Handles modals related to stat template creation and editing.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === GM Create Default Game Stat Field ===
    if (customId.startsWith('createStatTemplate:')) {
        const [, gameId] = customId.split(':');

        try {
            const label = interaction.fields.getTextInputValue('label')?.trim();
            const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim() || null;
            const fieldType = interaction.fields.getTextInputValue('field_type')?.trim().toLowerCase();
            const sortOrderRaw = interaction.fields.getTextInputValue('sort_order')?.trim();
            const sortOrder = isNaN(parseInt(sortOrderRaw)) ? 0 : parseInt(sortOrderRaw, 10);

            if (!label || !['short', 'paragraph'].includes(fieldType)) {
                return interaction.reply({
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

            // Fetch updated field list
            const allFields = await getStatTemplates(gameId);
            const fieldDescriptions = allFields.map(f => {
                const icon = f.field_type === 'paragraph' ? '📝' : '🔹';
                const defaultVal = f.default_value ? ` _(default: ${f.default_value})_` : '';
                return `${icon} **${f.label}**${defaultVal}`;
            });

            const embed = new EmbedBuilder()
                .setTitle('📋 Current Stat Template')
                .setDescription(fieldDescriptions.length ? fieldDescriptions.join('\n') : '*No fields yet.*')
                .setColor(0x00b0f4);

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`defineStats:${gameId}`)
                    .setLabel('➕ Add Another Stat')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`finishStatSetup:${gameId}`)
                    .setLabel('✅ Done')
                    .setStyle(ButtonStyle.Success)
            );

            return interaction.reply({
                content: `✅ Added stat field **${label}**.`,
                embeds: [embed],
                components: [actionRow],
                ephemeral: true,
            });

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
            const label = interaction.fields.getTextInputValue('label')?.trim();
            const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim();
            const fieldType = interaction.fields.getTextInputValue('field_type')?.trim().toLowerCase();

            if (!label || !['short', 'paragraph'].includes(fieldType)) {
                return interaction.reply({
                    content: '⚠️ Invalid input. Field type must be `short` or `paragraph`.',
                    ephemeral: true,
                });
            }

            const updated = await updateStatTemplate(statId, {
                label,
                default_value: defaultValue,
                field_type: fieldType,
            });

            return interaction.reply({
                content: `✅ Updated stat field **${updated.label}**.`,
                ephemeral: true,
            });

        } catch (err) {
            console.error('Error in editStatTemplateModal:', err);
            return interaction.reply({
                content: '❌ Failed to update stat template.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
