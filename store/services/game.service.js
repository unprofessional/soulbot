// store/services/game.service.js

const GameDAO = require('../dao/game.dao.js');
const StatTemplateDAO = require('../dao/stat_template.dao.js');

const gameDAO = new GameDAO();
const statTemplateDAO = new StatTemplateDAO();

/**
 * Create a new game session.
 */
async function createGame({ name, description, createdBy, guildId }) {
    return gameDAO.create({
        name,
        description,
        created_by: createdBy,
        guild_id: guildId,
    });
}

/**
 * Update a game's name or description.
 */
async function updateGame(gameId, updatePayload) {
    return gameDAO.update(gameId, updatePayload);
}

/**
 * Get a game by ID or Discord guild.
 */
async function getGame({ id, guildId }) {
    if (id) return gameDAO.findById(id);
    if (guildId) return gameDAO.findByGuild(guildId);
    return null;
}

/**
 * Get all games created by a user, optionally filtered by guild.
 */
async function getGamesByUser(userId, guildId = null) {
    const allGames = await gameDAO.findByUser(userId);

    // Optional: Filter by guild ID if provided
    if (guildId) {
        return allGames.filter(g => g.guild_id === guildId);
    }

    return allGames;
}

/**
 * Get all stat templates for a game.
 */
async function getStatTemplates(gameId) {
    return statTemplateDAO.findByGame(gameId);
}

async function getStatTemplateById(statId) {
    return statTemplateDAO.findById(statId);
}

/**
 * Update an individual stat template field.
 */
async function updateStatTemplate(statId, updatePayload) {
    return statTemplateDAO.updateById(statId, updatePayload);
}

/**
 * Add one or more stat templates to a game.
 */
async function addStatTemplates(gameId, templateList) {
    return statTemplateDAO.bulkCreate(gameId, templateList);
}

/**
 * Delete all stat templates for a game (e.g. wipe/reset).
 */
async function clearStatTemplates(gameId) {
    return statTemplateDAO.deleteByGame(gameId);
}

/**
 * 
 * Publish the game to make it public
 */
async function publishGame(gameId) {
    return gameDAO.publish(gameId);
}

/**
 * Toggle a game's public visibility (flip is_public).
 */
async function togglePublish(gameId) {
    return gameDAO.togglePublish(gameId);
}

module.exports = {
    createGame,
    updateGame,
    getGame,
    getGamesByUser,
    getStatTemplates,
    getStatTemplateById,
    updateStatTemplate,
    addStatTemplates,
    clearStatTemplates,
    publishGame,
    togglePublish,
};
