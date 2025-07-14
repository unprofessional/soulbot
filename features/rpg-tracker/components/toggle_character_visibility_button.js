// features/rpg-tracker/components/toggle_character_visibility_button.js

console.log('✅ Loading toggle_character_visibility_button.js...');

const {
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getCharacterWithStats, updateCharacterMeta } = require('../../../store/services/character.service');

console.log('✅ Loaded toggle_character_visibility_button.js correctly');

const id = 'toggle_visibility';

/**
 * Builds the publish/unpublish toggle button.
 * @param {string} characterId
 * @param {string} currentVisibility - "public" or "private"
 * @returns {ButtonBuilder}
 */
function build(characterId, currentVisibility = 'private') {
    const isPublic = (currentVisibility || '').toLowerCase() === 'public';

    return new ButtonBuilder()
        .setCustomId(`${id}:${characterId}`)
        .setLabel(isPublic ? '🔒 Unpublish Character' : '🌐 Publish Character')
        .setStyle(ButtonStyle.Secondary);
}

/**
 * Handles publish/unpublish toggle.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const [, characterId] = interaction.customId.split(':');

    try {
        const character = await getCharacterWithStats(characterId);

        if (!character) {
            return await interaction.reply({
                content: '⚠️ Character not found.',
                ephemeral: true,
            });
        }

        const current = (character.visibility || 'private').toLowerCase();
        const newVisibility = current === 'private' ? 'public' : 'private';

        await updateCharacterMeta(characterId, { visibility: newVisibility });

        const updated = await getCharacterWithStats(characterId);

        const { build: buildCharacterCard } = require('./view_character_card');

        const updatedCard = await buildCharacterCard(updated, {
            viewerUserId: interaction.user.id,
        });

        return await interaction.update({
            ...updatedCard,
            content: `✅ Visibility set to **${newVisibility.charAt(0).toUpperCase() + newVisibility.slice(1)}**.`,
        });

    } catch (err) {
        console.error('[TOGGLE VISIBILITY ERROR]', err);
        return await interaction.reply({
            content: '❌ Failed to toggle visibility.',
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
