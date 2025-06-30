// features/rpg-tracker/button_handlers/character_creation_buttons.js

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

const {
    isDraftComplete,
    getTempCharacterData,
    finalizeCharacterCreation,
    upsertTempCharacterField,
} = require('../../../store/services/character_draft.service');

const {
    getCharacterWithStats,
    getUserDefinedFields,
} = require('../../../store/services/character.service');

const {
    getGame,
    getStatTemplates,
} = require('../../../store/services/game.service');

const {
    rebuildCreateCharacterResponse,
} = require('../utils/rebuild_create_character_response');

/**
 * Handles character creation final submission and field-level interactions.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { user, customId } = interaction;
    const userId = user.id;

    // === Final submission ===
    if (customId === 'submitNewCharacter') {
        try {
            const complete = await isDraftComplete(userId);
            if (!complete) {
                return await interaction.reply({
                    content: '⚠️ Your character is missing required fields. Please finish filling them out.',
                    ephemeral: true,
                });
            }

            const draft = await getTempCharacterData(userId);
            const character = await finalizeCharacterCreation(userId, draft);
            const fullCharacter = await getCharacterWithStats(character.id);

            return await interaction.update({
                content: `✅ Character **${character.name}** created successfully!`,
                embeds: [buildCharacterEmbed(fullCharacter)],
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

    // === Visibility toggle ===
    if (customId === 'toggleCharacterVisibility') {
        try {
            const draft = await getTempCharacterData(userId);
            if (!draft) {
                return interaction.reply({
                    content: '⚠️ Could not load your character draft.',
                    ephemeral: true,
                });
            }

            const newVisibility = !draft['core:visibility'];
            await upsertTempCharacterField(userId, 'core:visibility', newVisibility, draft.game_id);

            const game = await getGame({ id: draft.game_id });
            const statTemplates = await getStatTemplates(draft.game_id);
            const userFields = await getUserDefinedFields(userId);

            const allFields = [
                { name: 'core:name', label: '[CORE] Name' },
                { name: 'core:bio', label: '[CORE] Bio' },
                { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
                // core:visibility is toggled, not editable via dropdown
                ...statTemplates.map(f => ({ name: `game:${f.id}`, label: `[GAME] ${f.label}` })),
                ...userFields.map(f => ({ name: `user:${f.name}`, label: `[USER] ${f.label || f.name}` })),
            ];

            const incompleteFields = allFields.filter(f => {
                const val = draft?.[f.name];
                return !val || !val.trim();
            });

            const response = rebuildCreateCharacterResponse(
                game,
                statTemplates,
                userFields,
                incompleteFields,
                draft
            );

            return interaction.update({
                content: `🔄 Visibility set to **${newVisibility ? 'Public' : 'Private'}**.`,
                ...response,
            });
        } catch (err) {
            console.error('Error toggling character visibility:', err);
            return await interaction.reply({
                content: '❌ Failed to toggle visibility.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
