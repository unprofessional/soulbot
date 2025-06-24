const GameDAO = require('../dao/game.dao.js');
const CharacterDAO = require('../dao/character.dao.js');
const CharacterStatFieldDAO = require('../dao/character_stat_field.dao.js');

const gameDAO = new GameDAO();
const characterDAO = new CharacterDAO();
const statDAO = new CharacterStatFieldDAO();

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
 * Create a character and optionally assign stats.
 */
async function createCharacter({ userId, gameId, name, className, race, level, hp, maxHp, notes, stats }) {
    const character = await characterDAO.create({
        user_id: userId,
        game_id: gameId,
        name,
        class: className,
        race,
        level,
        hp,
        max_hp: maxHp,
        notes,
    });

    if (stats && typeof stats === 'object') {
        await statDAO.bulkUpsert(character.id, stats);
    }

    return character;
}

/**
 * Get character by ID, including stats.
 */
async function getCharacterWithStats(characterId) {
    const character = await characterDAO.findById(characterId);
    if (!character) return null;

    const stats = await statDAO.findByCharacter(characterId);
    return { ...character, stats };
}

/**
 * Get all characters for a user (optionally scoped to game).
 */
async function getCharactersByUser(userId, gameId = null) {
    const all = await characterDAO.findByUser(userId);
    return gameId ? all.filter(c => c.game_id === gameId) : all;
}

/**
 * Get all characters in a game.
 */
async function getCharactersByGame(gameId) {
    return characterDAO.findByGame(gameId);
}

/**
 * Update a stat for a character.
 */
async function updateStat(characterId, statName, newValue) {
    return statDAO.create(characterId, statName, newValue); // upsert logic
}

/**
 * Update multiple stats.
 */
async function updateStats(characterId, statMap) {
    return statDAO.bulkUpsert(characterId, statMap);
}

/**
 * Adjust character HP.
 */
async function updateHP(characterId, hp, maxHp) {
    return characterDAO.updateHP(characterId, hp, maxHp);
}

/**
 * Update character metadata (name/class/race/level).
 */
async function updateCharacterMeta(characterId, fields) {
    return characterDAO.updateMeta(characterId, fields);
}

/**
 * Delete character and stat records.
 */
async function deleteCharacter(characterId) {
    await statDAO.deleteByCharacter(characterId); // optional, ON DELETE CASCADE may already handle this
    await characterDAO.delete(characterId);
}

module.exports = {
    createGame,
    getGame,
    createCharacter,
    getCharacterWithStats,
    getCharactersByUser,
    getCharactersByGame,
    updateStat,
    updateStats,
    updateHP,
    updateCharacterMeta,
    deleteCharacter,
};
