const CharacterDAO = require('../dao/character.dao.js');
const CharacterStatFieldDAO = require('../dao/character_stat_field.dao.js');
const CharacterCustomFieldDAO = require('../dao/character_custom_field.dao.js');
const PlayerDAO = require('../dao/player.dao.js');
const { getStatTemplates } = require('./game.service.js');

const characterDAO = new CharacterDAO();
const statDAO = new CharacterStatFieldDAO();
const customDAO = new CharacterCustomFieldDAO();
const playerDAO = new PlayerDAO();

async function createCharacter({
    userId,
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

    await playerDAO.setCurrentCharacter(userId, character.id);

    return character;
}

async function getCharacterWithStats(characterId) {
    const character = await characterDAO.findById(characterId);
    if (!character) return null;

    const stats = await statDAO.findByCharacter(characterId); // { template_id, value }
    const custom = await customDAO.findByCharacter(characterId); // [{ name, value }]

    const templates = await getStatTemplates(character.game_id); // [{ id, label, field_type }]
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

async function getCharactersByUser(userId, gameId = null) {
    const all = await characterDAO.findByUser(userId);
    return gameId ? all.filter(c => c.game_id === gameId) : all;
}

async function getCharactersByGame(gameId) {
    return characterDAO.findByGame(gameId);
}

async function updateStat(characterId, statName, newValue) {
    return statDAO.create(characterId, statName, newValue); // upsert
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
    // In future: support per-user custom field templates
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
