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

/**
 * Sets a temporary field in the user's draft.
 * @param {string} userId
 * @param {string} fieldKey - e.g. "core:name" or "game:uuid"
 * @param {string} value
 */
async function upsertTempCharacterField(userId, fieldKey, value) {
    const draft = initDraft(userId);
    draft[fieldKey] = value;
}

/**
 * Returns the current in-memory draft for a user.
 */
async function getTempCharacterData(userId) {
    return drafts.get(getDraftKey(userId)) || null;
}

/**
 * Returns an array of missing required fields (core + game)
 */
async function getRemainingRequiredFields(userId) {
    const draft = await getTempCharacterData(userId);
    if (!draft || !draft.game_id) return [];

    const missing = [];

    // Check required CORE fields
    const requiredCore = ['name'];
    for (const field of requiredCore) {
        const key = `core:${field}`;
        if (!draft[key] || !draft[key].trim()) {
            missing.push({ name: key, label: `[CORE] ${field}` });
        }
    }

    // Check required GAME-defined fields
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
 * Returns true if all required fields are filled in the draft.
 */
async function isDraftComplete(userId) {
    const remaining = await getRemainingRequiredFields(userId);
    return remaining.length === 0;
}

/**
 * Finalizes character creation by writing to DB from draft.
 */
async function finalizeCharacterCreation(userId, draft) {
    const {
        game_id,
    } = draft;

    // Extract core fields
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

    // Extract stat field values
    const statTemplates = await getStatTemplates(game_id);
    const statMap = {};

    for (const template of statTemplates) {
        const key = `game:${template.id}`;
        if (draft[key]) {
            statMap[template.id] = draft[key];
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
    isDraftComplete,
    finalizeCharacterCreation,
};
