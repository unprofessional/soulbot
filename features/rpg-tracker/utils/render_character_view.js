// features/rpg-tracker/utils/render_character_view.js

const { buildCharacterEmbed, buildCharacterActionRow } = require('../embed_utils');

/**
 * Returns the full message payload to render a character sheet.
 * @param {object} character - Full hydrated character object
 * @returns {object} Discord interaction update/reply-compatible message object
 */
function renderCharacterView(character) {
    return {
        content: `🧬 Character Sheet: **${character.name}**`,
        embeds: [buildCharacterEmbed(character)],
        components: [buildCharacterActionRow(character.id, character.visibility)],
    };
}

module.exports = {
    renderCharacterView,
};
