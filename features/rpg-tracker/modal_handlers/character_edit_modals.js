// features/rpg-tracker/modal_handlers/character_edit_modals.js

const { updateStat, updateCharacterMeta } = require('../../store/services/character.service');

/**
 * Handles modals related to character stat or metadata editing.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === Edit Stat ===
    if (customId.startsWith('editStatModal:')) {
        const [, characterId] = customId.split(':');

        try {
            const statName = interaction.fields.getTextInputValue('statName')?.toLowerCase().trim();
            const statValue = parseInt(interaction.fields.getTextInputValue('statValue'), 10);

            if (!/^[a-zA-Z0-9_]{1,20}$/.test(statName)) {
                return interaction.reply({
                    content: '⚠️ Invalid stat name. Use short alphanumeric identifiers (e.g., `hp`, `mana`).',
                    ephemeral: true,
                });
            }

            if (isNaN(statValue)) {
                return interaction.reply({
                    content: '⚠️ Invalid stat value. Must be a number.',
                    ephemeral: true,
                });
            }

            await updateStat(characterId, statName, statValue);

            return interaction.reply({
                content: `🎲 Updated **${statName.toUpperCase()}** to **${statValue}**.`,
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in editStatModal:', err);
            return interaction.reply({
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
                return interaction.reply({
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

            return interaction.reply({
                content: `📝 Character **${name}** updated successfully.`,
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in editCharacterModal:', err);
            return interaction.reply({
                content: '❌ Failed to update character info.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
