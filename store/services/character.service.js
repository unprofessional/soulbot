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
    if (!character) {
        console.warn('⚠️ Character not found:', characterId);
        return null;
    }

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

    const results = all.filter(c => c.game_id === currentGameId);
    return results;
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
    const existing = await characterDAO.findById(characterId);
    if (!existing) throw new Error('Character not found');

    const merged = {
        name: existing.name,
        avatar_url: existing.avatar_url,
        bio: existing.bio,
        visibility: existing.visibility,
        ...fields, // override with incoming
    };

    return characterDAO.updateMeta(characterId, merged);
}

async function deleteCharacter(characterId) {
    await statDAO.deleteByCharacter(characterId);
    await customDAO.deleteByCharacter(characterId);
    await characterDAO.delete(characterId);
}

async function getUserDefinedFields(userId) {
    console.log('🔧 getUserDefinedFields > userId:', userId);
    return [];
}

async function getCharacterSummary(character) {
    const statFields = await statDAO.findByCharacter(character.id);
    const templates = await getStatTemplates(character.game_id);

    const templateMap = Object.fromEntries(templates.map(t => [t.id, t]));

    const enriched = statFields
        .map(field => {
            const template = templateMap[field.template_id];
            return {
                label: template?.label || 'Unknown',
                sort_order: template?.sort_order ?? 999,
                value: field.value,
            };
        })
        .sort((a, b) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
            return a.label.localeCompare(b.label);
        })
        .slice(0, 2);

    return enriched;
}

async function updateStatMetaField(characterId, templateId, metaKey, newValue) {

    const existingStats = await statDAO.findByCharacter(characterId);
    const target = existingStats.find(s => s.template_id === templateId);

    if (!target) throw new Error(`Stat ${templateId} not found on character ${characterId}`);

    const updatedMeta = {
        ...(target.meta || {}),
        [metaKey]: newValue,
    };

    return statDAO.create(characterId, templateId, target.value ?? '', updatedMeta);
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
    getCharacterSummary,
    updateStatMetaField,
};
