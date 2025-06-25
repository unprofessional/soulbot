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
 * Get a game by ID or Discord guild.
 */
async function getGame({ id, guildId }) {
    if (id) return gameDAO.findById(id);
    if (guildId) return gameDAO.findByGuild(guildId);
    return null;
}

/**
 * Get all stat templates for a game.
 */
async function getStatTemplates(gameId) {
    return statTemplateDAO.findByGame(gameId);
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

module.exports = {
    createGame,
    getGame,
    getStatTemplates,
    addStatTemplates,
    clearStatTemplates,
    publishGame,
};
