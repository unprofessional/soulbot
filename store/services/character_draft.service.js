// store/services/character_draft.service.js

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
 * Will also inject game_id if passed and not already set.
 * @param {string} userId
 * @param {string} fieldKey - e.g., "core:name", "game:<template_id>"
 * @param {string} value
 * @param {string|null} gameId - optional game_id to inject into draft
 */
async function upsertTempCharacterField(userId, fieldKey, value, gameId = null) {
    const draft = initDraft(userId);
    draft[fieldKey] = value;

    if (gameId && !draft.game_id) {
        draft.game_id = gameId;
        console.log(`📝 Injected game_id (${gameId}) into draft for user ${userId}`);
    }

    console.log(`📝 Upserted draft field [${fieldKey}]:`, value);
    console.log('🗂️  Current draft:', JSON.stringify(draft, null, 2));
}

/**
 * Returns the current in-memory character draft for the user.
 */
async function getTempCharacterData(userId) {
    const draft = drafts.get(getDraftKey(userId)) || null;
    console.log(`📄 getTempCharacterData(${userId}):`, draft);
    return draft;
}

/**
 * Returns a list of required fields (core + game-defined) that are missing from the draft.
 */
async function getRemainingRequiredFields(userId) {
    const draft = await getTempCharacterData(userId);

    if (!draft) {
        console.warn(`⚠️ No draft found for user ${userId}`);
        return [];
    }

    if (!draft.game_id) {
        console.warn(`⚠️ Draft for user ${userId} missing game_id — cannot compute required fields`);
        return [];
    }

    const missing = [];

    // === Required core fields ===
    const requiredCore = [
        { name: 'core:name', label: '[CORE] Name' },
        { name: 'core:bio', label: '[CORE] Bio' },
        { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
    ];

    for (const core of requiredCore) {
        const value = draft[core.name];
        if (!value || !value.trim()) {
            missing.push(core);
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

    console.log(`📋 Remaining required fields for user ${userId}:`, missing);
    return missing;
}

/**
 * Returns true if the draft contains all required core and game-defined fields.
 */
async function isDraftComplete(userId) {
    const remaining = await getRemainingRequiredFields(userId);
    const complete = remaining.length === 0;
    console.log(`✅ isDraftComplete(${userId}) →`, complete);
    return complete;
}

/**
 * Converts the draft into a finalized character and persists it.
 */
async function finalizeCharacterCreation(userId, draft) {
    const { game_id } = draft;

    console.log(`🚀 Finalizing character for user ${userId} in game ${game_id}`);
    console.log('🧾 Draft data:', JSON.stringify(draft, null, 2));

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
    console.log(`🗑️ Cleared draft for user ${userId}`);

    return character;
}

module.exports = {
    initDraft,
    upsertTempCharacterField,
    getTempCharacterData,
    getRemainingRequiredFields,
    isDraftComplete,
    finalizeCharacterCreation,
};
