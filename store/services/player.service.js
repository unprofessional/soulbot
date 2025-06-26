// store/services/player.service.js

const PlayerDAO = require('../dao/player.dao.js');
const playerDAO = new PlayerDAO();

/**
 * Ensures global player record exists and sets up server-specific link.
 * @param {string} discordId - Discord user ID
 * @param {string} guildId - Guild/server ID
 * @param {string} role - Optional role: 'player' or 'gm'
 * @returns {Promise<Object>} player_server_link record
 */
async function getOrCreatePlayer(discordId, guildId, role = 'player') {
    if (!guildId) throw new Error('guildId is required to upsert player_server_link');
    await playerDAO.createGlobalPlayer(discordId);
    return await playerDAO.upsertPlayerServerLink({ discordId, guildId, role });
}

/**
 * Sets the current active character for a player in a specific server.
 * @param {string} discordId 
 * @param {string} guildId 
 * @param {string} characterId 
 * @returns {Promise<Object>} updated link record
 */
async function setCurrentCharacter(discordId, guildId, characterId) {
    return await playerDAO.setCurrentCharacter(discordId, guildId, characterId);
}

/**
 * Retrieves the current character ID for a player in a specific server.
 * @param {string} discordId 
 * @param {string} guildId 
 * @returns {Promise<string|null>}
 */
async function getCurrentCharacter(discordId, guildId) {
    return await playerDAO.getCurrentCharacter(discordId, guildId);
}

/**
 * Sets the current active game for a player in a specific server.
 * @param {string} discordId 
 * @param {string} guildId 
 * @param {string} gameId 
 * @returns {Promise<Object>} updated link record
 */
async function setCurrentGame(discordId, guildId, gameId) {
    console.log('[setCurrentGame] Attempting to set:', { discordId, guildId, gameId });
    const updated = await playerDAO.setCurrentGame(discordId, guildId, gameId);
    console.log('[setCurrentGame] Updated record:', updated);
    return updated;
}

/**
 * Retrieves the current game ID for a player in a specific server.
 * @param {string} discordId 
 * @param {string} guildId 
 * @returns {Promise<string|null>}
 */
async function getCurrentGame(discordId, guildId) {
    return await playerDAO.getCurrentGame(discordId, guildId);
}

module.exports = {
    getOrCreatePlayer,
    setCurrentCharacter,
    getCurrentCharacter,
    setCurrentGame,
    getCurrentGame,
};
