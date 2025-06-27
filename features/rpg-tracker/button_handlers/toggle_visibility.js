// features/rpg-tracker/button_handlers/toggle_visibility.js

const {
    getCharacterWithStats,
    updateCharacterMeta,
} = require('../../../store/services/character.service');

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

/**
 * Toggles core:visibility between "private" and "public".
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;
    const [, characterId] = customId.split(':');

    try {
        const full = await getCharacterWithStats(characterId);

        if (!full) {
            return await interaction.reply({
                content: '⚠️ Character not found.',
                ephemeral: true,
            });
        }

        const current = (full.visibility || 'private').toLowerCase();
        const newVisibility = current === 'private' ? 'public' : 'private';

        await updateCharacterMeta(characterId, 'core:visibility', newVisibility);

        const updated = await getCharacterWithStats(characterId);

        return await interaction.update({
            content: `✅ Visibility set to **${newVisibility.charAt(0).toUpperCase() + newVisibility.slice(1)}**.`,
            embeds: [buildCharacterEmbed(updated)],
            components: [buildCharacterActionRow(characterId)],
        });
    } catch (err) {
        console.error('Error toggling visibility:', err);
        return await interaction.reply({
            content: '❌ Failed to toggle visibility.',
            ephemeral: true,
        });
    }
}

module.exports = { handle };
