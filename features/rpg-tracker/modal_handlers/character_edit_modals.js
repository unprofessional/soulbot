// features/rpg-tracker/modal_handlers/character_edit_modals.js

const {
    getCharacterWithStats,
    updateStat,
    updateCharacterMeta,
    updateStatMetaField,
} = require('../../../store/services/character.service');

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

/**
 * Handles modals related to character stat or metadata editing.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    try {
        const { customId } = interaction;

        // === Edit GAME Stat ===
        if (customId.startsWith('editStatModal:')) {
            const [, characterId, fieldType, fieldKey] = customId.split(':');

            if (fieldType === 'count') {
                const maxValue = interaction.fields.getTextInputValue(`${fieldKey}:max`)?.trim();
                const currentValue = interaction.fields.getTextInputValue(`${fieldKey}:current`)?.trim();
                const parsedMax = parseInt(maxValue, 10);
                const parsedCurrent = currentValue ? parseInt(currentValue, 10) : parsedMax;

                if (isNaN(parsedMax)) {
                    return await interaction.reply({
                        content: '⚠️ Invalid MAX value entered.',
                        ephemeral: true,
                    });
                }

                console.log('[editStatModal] Updating COUNT stat via meta:', {
                    characterId, fieldKey, parsedMax, parsedCurrent,
                });

                await updateStatMetaField(characterId, fieldKey, 'max', parsedMax);
                await updateStatMetaField(characterId, fieldKey, 'current', parsedCurrent);
            } else {
                const newValue = interaction.fields.getTextInputValue(fieldKey)?.trim();

                if (typeof newValue !== 'string') {
                    return await interaction.reply({
                        content: '⚠️ Invalid stat update.',
                        ephemeral: true,
                    });
                }

                console.log('[editStatModal] Updating VALUE stat:', { characterId, fieldKey, newValue });
                await updateStat(characterId, fieldKey, newValue);
            }

            await interaction.deferUpdate();

            const updated = await getCharacterWithStats(characterId);
            const embed = buildCharacterEmbed(updated);
            const row = buildCharacterActionRow(characterId, updated.visibility);

            return await interaction.editReply({
                content: null,
                embeds: [embed],
                components: [row],
            });
        }

        // === Edit CORE Field ===
        if (customId.startsWith('setCharacterField:') || customId.startsWith('editCharacterField:')) {
            const parts = customId.split(':');
            const characterId = parts[1];
            const fullKeyWithLabel = parts.slice(2).join(':');
            const [fieldKey] = fullKeyWithLabel.split('|');
            const [, coreField] = fieldKey.includes(':') ? fieldKey.split(':') : [null, fieldKey];

            const newValue =
                interaction.fields.getTextInputValue(fieldKey)?.trim() ??
                interaction.fields.getTextInputValue(coreField)?.trim();

            if (!coreField || typeof newValue !== 'string') {
                return await interaction.reply({
                    content: '⚠️ Invalid core field update.',
                    ephemeral: true,
                });
            }

            console.log('[editCharacterField] Submitting field update:', {
                characterId, coreField, newValue, fieldKey,
            });

            await updateCharacterMeta(characterId, { [coreField]: newValue });

            await interaction.deferUpdate();

            const updated = await getCharacterWithStats(characterId);
            const embed = buildCharacterEmbed(updated);
            const row = buildCharacterActionRow(characterId, updated.visibility);

            return await interaction.editReply({
                content: null,
                embeds: [embed],
                components: [row],
            });
        }

        // === Edit Full Metadata ===
        if (customId.startsWith('editCharacterModal:')) {
            const [, characterId] = customId.split(':');

            const name = interaction.fields.getTextInputValue('name')?.trim();
            const className = interaction.fields.getTextInputValue('class')?.trim();
            const race = interaction.fields.getTextInputValue('race')?.trim();
            const level = parseInt(interaction.fields.getTextInputValue('level'), 10);
            const notes = interaction.fields.getTextInputValue('notes')?.trim();

            if (!name || !className || isNaN(level)) {
                return await interaction.reply({
                    content: '⚠️ Invalid input. Please provide valid name, class, and level.',
                    ephemeral: true,
                });
            }

            console.log('[editCharacterModal] Updating metadata:', {
                name, className, race, level, notes,
            });

            await updateCharacterMeta(characterId, {
                name,
                class: className,
                race,
                level,
                notes,
            });

            return await interaction.reply({
                content: `📝 Character **${name}** updated successfully.`,
                ephemeral: true,
            });
        }

        console.warn('[character_edit_modals] No matching modal handler for customId:', customId);
        return await interaction.reply({
            content: '❓ Unrecognized modal submission.',
            ephemeral: true,
        });
    } catch (err) {
        console.error('[character_edit_modals] Uncaught exception in modal handler:', err);
        return await interaction.reply({
            content: '❌ An unexpected error occurred while processing your request.',
            ephemeral: true,
        });
    }
}

module.exports = { handle };
