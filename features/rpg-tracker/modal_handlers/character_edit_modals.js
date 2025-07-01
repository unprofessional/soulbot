// features/rpg-tracker/modal_handlers/character_edit_modals.js

const {
    getCharacterWithStats,
    updateStat,
    updateCharacterMeta,
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
    const { customId } = interaction;

    // === Edit Stat ===
    if (customId.startsWith('editStatModal:')) {
        const [, characterId, fieldKey] = customId.split(':');

        try {
            const newValue = interaction.fields.getTextInputValue('statValue')?.trim();

            if (!fieldKey || typeof newValue !== 'string') {
                return await interaction.reply({
                    content: '⚠️ Invalid stat update request.',
                    ephemeral: true,
                });
            }

            await updateStat(characterId, fieldKey, newValue);

            // Must reply before editReply — even with a placeholder
            await interaction.reply({
                content: `🎲 Updated **${fieldKey.toUpperCase()}** to **${newValue}**.`,
                ephemeral: true,
            });

            const updated = await getCharacterWithStats(characterId);
            const embed = buildCharacterEmbed(updated);
            const row = buildCharacterActionRow(characterId);

            return await interaction.editReply({
                content: null, // clear the text message if desired
                embeds: [embed],
                components: [row],
            });
        } catch (err) {
            console.error('Error in editStatModal:', err);
            return await interaction.reply({
                content: '❌ Failed to update stat.',
                ephemeral: true,
            });
        }
    }

    // === Edit Character Metadata ===
    if (customId.startsWith('editCharacterModal:')) {
        const [, characterId] = customId.split(':');

        try {
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
        } catch (err) {
            console.error('Error in editCharacterModal:', err);
            return await interaction.reply({
                content: '❌ Failed to update character info.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
