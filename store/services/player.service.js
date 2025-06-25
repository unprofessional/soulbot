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

/**
 * Updates the current active game ID for a given player.
 * @param {string} discordId 
 * @param {string} gameId 
 * @returns {Promise<Object>} updated player record
 */
async function setCurrentGame(discordId, gameId) {
    return await playerDAO.setCurrentGame(discordId, gameId);
}

/**
 * Returns the currently selected game ID for a player.
 * @param {string} discordId 
 * @returns {Promise<string|null>}
 */
async function getCurrentGame(discordId) {
    return await playerDAO.getCurrentGame(discordId);
}

module.exports = {
    getOrCreatePlayer,
    setCurrentCharacter,
    getCurrentCharacter,
    setCurrentGame,
    getCurrentGame,
};
