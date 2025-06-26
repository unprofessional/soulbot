// store/services/character.service.js

const CharacterDAO = require('../dao/character.dao.js');
const CharacterStatFieldDAO = require('../dao/character_stat_field.dao.js');
const CharacterCustomFieldDAO = require('../dao/character_custom_field.dao.js');
const PlayerDAO = require('../dao/player.dao.js');
const { getStatTemplates } = require('./game.service.js');
const { getCurrentGame } = require('./player.service.js');

const characterDAO = new CharacterDAO();
const statDAO = new CharacterStatFieldDAO();
const customDAO = new CharacterCustomFieldDAO();
const playerDAO = new PlayerDAO();

/**
 * Creates a character and sets it as the current one for the user in this guild.
 */
async function createCharacter({
    userId,
    guildId,
    gameId,
    name,
    clazz,
    race,
    level = 1,
    notes = null,
    stats = {},
    customFields = {},
}) {
    const character = await characterDAO.create({
        user_id: userId,
        game_id: gameId,
        name,
        class: clazz,
        race,
        level,
        notes,
    });

    if (stats && typeof stats === 'object') {
        await statDAO.bulkUpsert(character.id, stats);
    }

    if (customFields && typeof customFields === 'object') {
        await customDAO.bulkUpsert(character.id, customFields);
    }

    // Patch: Now sets character by user and guild context
    await playerDAO.setCurrentCharacter(userId, guildId, character.id);

    return character;
}

async function getCharacterWithStats(characterId) {
    const character = await characterDAO.findById(characterId);
    if (!character) return null;

    const stats = await statDAO.findByCharacter(characterId);
    const custom = await customDAO.findByCharacter(characterId);

    const templates = await getStatTemplates(character.game_id);
    const templateMap = Object.fromEntries(templates.map(t => [t.id, t]));

    const enrichedStats = stats.map(stat => {
        const template = templateMap[stat.template_id];
        return {
            ...stat,
            label: template?.label || stat.template_id,
            field_type: template?.field_type || 'short',
        };
    });

    return {
        ...character,
        stats: enrichedStats,
        customFields: custom,
    };
}

/**
 * Returns all characters belonging to a user for the current game in this guild.
 */
async function getCharactersByUser(userId, guildId) {
    const currentGameId = await getCurrentGame(userId, guildId);
    if (!currentGameId) return [];

    const all = await characterDAO.findByUser(userId);
    return all.filter(c => c.game_id === currentGameId);
}

async function getCharactersByGame(gameId) {
    return characterDAO.findByGame(gameId);
}

async function updateStat(characterId, statName, newValue) {
    return statDAO.create(characterId, statName, newValue);
}

async function updateStats(characterId, statMap) {
    return statDAO.bulkUpsert(characterId, statMap);
}

async function updateCharacterMeta(characterId, fields) {
    return characterDAO.updateMeta(characterId, fields);
}

async function deleteCharacter(characterId) {
    await statDAO.deleteByCharacter(characterId);
    await customDAO.deleteByCharacter(characterId);
    await characterDAO.delete(characterId);
}

async function getUserDefinedFields(userId) {
    // Placeholder: future user template support
    return [];
}

module.exports = {
    createCharacter,
    getCharacterWithStats,
    getCharactersByUser,
    getCharactersByGame,
    updateStat,
    updateStats,
    updateCharacterMeta,
    deleteCharacter,
    getUserDefinedFields,
};
