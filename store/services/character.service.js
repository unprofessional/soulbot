// store/services/character.service.js

const CharacterDAO = require('../dao/character.dao.js');
const CharacterStatFieldDAO = require('../dao/character_stat_field.dao.js');
const PlayerDAO = require('../dao/player.dao.js');

const characterDAO = new CharacterDAO();
const statDAO = new CharacterStatFieldDAO();
const playerDAO = new PlayerDAO();

async function createCharacter({ userId, gameId, name, clazz, race, level = 1, notes = null, stats = {} }) {
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

    await playerDAO.setCurrentCharacter(userId, character.id);

    return character;
}

async function getCharacterWithStats(characterId) {
    const character = await characterDAO.findById(characterId);
    if (!character) return null;

    const stats = await statDAO.findByCharacter(characterId);
    return { ...character, stats };
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
    await characterDAO.delete(characterId);
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
};
