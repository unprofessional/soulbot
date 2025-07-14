// features/rpg-tracker/utils/render_character_view.js

const { isActiveCharacter } = require('./is_active_character');
const { build: buildCharacterCard } = require('../components/view_character_card');

/**
 * Returns the full message payload to render a character sheet.
 * @param {object} character - Full hydrated character object
 * @param {object} context - Viewer info
 * @param {string} context.userId - Discord user ID
 * @param {string} context.guildId - Discord guild ID
 * @returns {Promise<object>} Discord interaction update/reply-compatible message object
 */
async function renderCharacterView(character, { userId, guildId }) {
    const isSelf = await isActiveCharacter(userId, guildId, character.id);
    return buildCharacterCard(character, { viewerUserId: isSelf ? userId : null });
}

module.exports = {
    renderCharacterView,
};
