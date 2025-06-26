// features/rpg-tracker/button_handlers/character_creation_buttons.js

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

const {
    isDraftComplete,
    getTempCharacterData,
    finalizeCharacterCreation,
} = require('../../../store/services/character_draft.service');

/**
 * Handles character creation final submission.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { user, customId } = interaction;

    if (customId !== 'submitNewCharacter') return;

    try {
        const userId = user.id;

        const complete = await isDraftComplete(userId);
        if (!complete) {
            return await interaction.reply({
                content: '⚠️ Your character is missing required fields. Please finish filling them out.',
                ephemeral: true,
            });
        }

        const draft = await getTempCharacterData(userId);
        const character = await finalizeCharacterCreation(userId, draft);

        return await interaction.update({
            content: `✅ Character **${character.name}** created successfully!`,
            embeds: [buildCharacterEmbed(character)],
            components: [buildCharacterActionRow(character.id)],
        });
    } catch (err) {
        console.error('Error submitting character:', err);
        return await interaction.reply({
            content: '❌ Failed to submit character. Please try again.',
            ephemeral: true,
        });
    }
}

module.exports = { handle };
