const CharacterDAO = require('../dao/character.dao');
const CharacterStatFieldDAO = require('../dao/character_stat_field.dao');
const { getStatTemplates } = require('./game.service');

const characterDAO = new CharacterDAO();
const statFieldDAO = new CharacterStatFieldDAO();

// In-memory store for drafts (replace with Redis for production)
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

/**
 * Temporarily stores a character field for the user.
 * @param {string} userId
 * @param {string} fieldKey - e.g., "core:name", "game:<template_id>"
 * @param {string} value
 */
async function upsertTempCharacterField(userId, fieldKey, value) {
    const draft = initDraft(userId);
    draft[fieldKey] = value;
}

/**
 * Returns the current in-memory character draft for the user.
 */
async function getTempCharacterData(userId) {
    return drafts.get(getDraftKey(userId)) || null;
}

/**
 * Returns a list of required fields (core + game-defined) that are missing from the draft.
 */
async function getRemainingRequiredFields(userId) {
    const draft = await getTempCharacterData(userId);
    if (!draft || !draft.game_id) return [];

    const missing = [];

    // === Required core fields ===
    const requiredCore = ['name'];
    for (const core of requiredCore) {
        const key = `core:${core}`;
        if (!draft[key] || !draft[key].trim()) {
            missing.push({ name: key, label: `[CORE] ${core}` });
        }
    }

    // === Required game-defined stat templates ===
    const statTemplates = await getStatTemplates(draft.game_id);
    for (const template of statTemplates) {
        if (template.is_required) {
            const key = `game:${template.id}`;
            if (!draft[key] || !draft[key].trim()) {
                missing.push({ name: key, label: `[GAME] ${template.label}` });
            }
        }
    }

    return missing;
}

/**
 * Returns true if the draft contains all required core and game-defined fields.
 */
async function isDraftComplete(userId) {
    const remaining = await getRemainingRequiredFields(userId);
    return remaining.length === 0;
}

/**
 * Converts the draft into a finalized character and persists it.
 */
async function finalizeCharacterCreation(userId, draft) {
    const { game_id } = draft;

    // Pull required core fields
    const name = draft['core:name']?.trim();
    const avatar_url = draft['core:avatar_url']?.trim() || null;
    const bio = draft['core:bio']?.trim() || null;
    const visibility = draft['core:visibility'] || 'private';

    const character = await characterDAO.create({
        user_id: userId,
        game_id,
        name,
        avatar_url,
        bio,
        visibility,
    });

    // Pull game-defined stat fields
    const statTemplates = await getStatTemplates(game_id);
    const statMap = {};

    for (const template of statTemplates) {
        const key = `game:${template.id}`;
        if (draft[key]) {
            statMap[template.id] = draft[key];
        }
    }

    await statFieldDAO.bulkUpsert(character.id, statMap);

    // Clear the draft now that it's persisted
    drafts.delete(getDraftKey(userId));

    return character;
}

module.exports = {
    upsertTempCharacterField,
    getTempCharacterData,
    getRemainingRequiredFields,
    isDraftComplete,
    finalizeCharacterCreation,
};
