// store/services/player.service.js

const PlayerDAO = require('../dao/player.dao.js');
const playerDAO = new PlayerDAO();

/**
 * Retrieves a player by Discord ID or creates one if not found.
 * @param {string} discordId 
 * @param {string} role 
 * @returns {Promise<Object>} player record
 */
async function getOrCreatePlayer(discordId, role = 'player') {
    return await playerDAO.create({ discordId, role });
}

/**
 * Updates the current active character ID for a given player.
 * @param {string} discordId 
 * @param {string} characterId 
 * @returns {Promise<Object>} updated player record
 */
async function setCurrentCharacter(discordId, characterId) {
    return await playerDAO.setCurrentCharacter(discordId, characterId);
}

/**
 * Returns the currently selected character ID for a player.
 * @param {string} discordId 
 * @returns {Promise<string|null>}
 */
async function getCurrentCharacter(discordId) {
    return await playerDAO.getCurrentCharacter(discordId);
}

module.exports = {
    getOrCreatePlayer,
    setCurrentCharacter,
    getCurrentCharacter,
};
