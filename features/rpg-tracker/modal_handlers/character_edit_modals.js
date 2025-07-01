// features/rpg-tracker/modal_handlers/character_edit_modals.js

const { updateStat, updateCharacterMeta } = require('../../../store/services/character.service');

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

            // Optionally: validate input (example if numeric expected)
            // const numericValue = parseFloat(newValue);
            // const isNumeric = !isNaN(numericValue);

            // You can enforce numeric-only logic here if needed:
            // if (!isNumeric) {
            //     return await interaction.reply({
            //         content: '⚠️ Stat value must be a number.',
            //         ephemeral: true,
            //     });
            // }

            await updateStat(characterId, fieldKey, newValue);

            return await interaction.reply({
                content: `🎲 Updated **${fieldKey.toUpperCase()}** to **${newValue}**.`,
                ephemeral: true,
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
