// features/rpg-tracker/utils/is_active_character.js

const { getCurrentCharacter } = require('../../../store/services/player.service');

/**
 * Returns true if the given characterId is the player's currently active character in this guild.
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @param {string} characterId - Character ID to compare
 * @returns {Promise<boolean>}
 */
async function isActiveCharacter(userId, guildId, characterId) {
    if (!userId || !guildId || !characterId) return false;
    try {
        const current = await getCurrentCharacter(userId, guildId);
        return current === characterId;
    } catch (err) {
        console.error('[isActiveCharacter] Failed to check:', { userId, guildId, characterId }, err);
        return false;
    }
}

module.exports = {
    isActiveCharacter,
};
