// store/services/character_draft.service.js

const CharacterDAO = require('../dao/character.dao');
const CharacterStatFieldDAO = require('../dao/character_stat_field.dao');
const { getStatTemplates } = require('./game.service');
const characterDAO = new CharacterDAO();
const statFieldDAO = new CharacterStatFieldDAO();

// In-memory store for drafts (use Redis or DB for persistence)
const drafts = new Map();

function getDraftKey(userId) {
    return `draft:${userId}`;
}

function initDraft(userId) {
    const key = getDraftKey(userId);
    if (!drafts.has(key)) {
        drafts.set(key, {});
    }
    return drafts.get(key);
}

async function upsertTempCharacterField(userId, fieldName, value) {
    const draft = initDraft(userId);
    draft[fieldName] = value;
}

async function getTempCharacterData(userId) {
    return drafts.get(getDraftKey(userId)) || null;
}

async function getRemainingRequiredFields(userId) {
    const draft = await getTempCharacterData(userId);
    if (!draft || !draft.game_id) return [];

    const statTemplates = await getStatTemplates(draft.game_id);
    const missing = statTemplates.filter(t => t.is_required && !draft[t.name]);

    return missing.map(f => ({ name: f.name, label: f.label }));
}

async function finalizeCharacterCreation(userId, draft) {
    const {
        game_id,
        name,
        class: clazz,
        race,
        level = 1,
        notes = null,
        ...stats
    } = draft;

    const character = await characterDAO.create({
        user_id: userId,
        game_id,
        name,
        class: clazz,
        race,
        level,
        notes,
    });

    // Match stats with actual stat templates
    const templates = await getStatTemplates(game_id);
    const templateIdMap = Object.fromEntries(templates.map(t => [t.name, t.id]));

    const statMap = {};
    for (const [key, val] of Object.entries(stats)) {
        if (templateIdMap[key]) {
            statMap[templateIdMap[key]] = val;
        }
    }

    await statFieldDAO.bulkUpsert(character.id, statMap);

    // Clear draft
    drafts.delete(getDraftKey(userId));

    return character;
}

module.exports = {
    upsertTempCharacterField,
    getTempCharacterData,
    getRemainingRequiredFields,
    finalizeCharacterCreation,
};
