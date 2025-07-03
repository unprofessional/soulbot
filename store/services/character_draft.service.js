// store/services/character_draft.service.js

const CharacterDAO = require('../dao/character.dao');
const CharacterStatFieldDAO = require('../dao/character_stat_field.dao');
const { getStatTemplates } = require('./game.service');

const characterDAO = new CharacterDAO();
const statFieldDAO = new CharacterStatFieldDAO();

// In-memory store for drafts (replace with Redis for production)
const drafts = new Map();
const STALE_TIMEOUT = 1000 * 60 * 30; // 30 minutes
const MAX_DRAFTS = 1000;

function getDraftKey(userId) {
    return `draft:${userId}`;
}

function initDraft(userId) {
    const key = getDraftKey(userId);
    if (!drafts.has(key)) {
        if (drafts.size >= MAX_DRAFTS) {
            console.warn('⚠️ Draft limit reached — new draft not created.');
            return null;
        }
        drafts.set(key, {
            data: {},
            updatedAt: Date.now(),
        });
    }
    return drafts.get(key).data;
}

async function upsertTempCharacterField(userId, fieldKey, value, gameId = null, meta = null) {
    const key = getDraftKey(userId);
    if (!drafts.has(key)) {
        initDraft(userId);
    }

    const wrapper = drafts.get(key);
    if (!wrapper) return;

    // Store value
    wrapper.data[fieldKey] = value;

    // If meta provided, store it under meta:<fieldKey>
    if (meta) {
        wrapper.data[`meta:${fieldKey}`] = meta;
    }

    wrapper.updatedAt = Date.now();

    if (gameId && !wrapper.data.game_id) {
        wrapper.data.game_id = gameId;
        console.log(`📝 Injected game_id (${gameId}) into draft for user ${userId}`);
    }

    console.log(`📝 Upserted draft field [${fieldKey}]:`, value);
    if (meta) {
        console.log(`📦 Stored meta for [${fieldKey}]:`, meta);
    }
    console.log('🗂️  Current draft:', JSON.stringify(wrapper.data, null, 2));
}

async function getTempCharacterData(userId) {
    const wrapper = drafts.get(getDraftKey(userId)) || null;
    const draft = wrapper ? wrapper.data : null;
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
        if (!template.is_required) continue;

        const baseKey = `game:${template.id}`;

        if (template.field_type === 'count') {
            const meta = draft[`meta:${baseKey}`];
            if (!meta || !meta.max) {
                missing.push({ name: baseKey, label: `[GAME] ${template.label}` });
            }
        } else {
            const val = draft[baseKey];
            if (!val || !val.trim()) {
                missing.push({ name: baseKey, label: `[GAME] ${template.label}` });
            }
        }
    }

    console.log(`📋 Remaining required fields for user ${userId}:`, missing);
    return missing;
}

async function isDraftComplete(userId) {
    const remaining = await getRemainingRequiredFields(userId);
    const complete = remaining.length === 0;
    console.log(`✅ isDraftComplete(${userId}) →`, complete);
    return complete;
}

async function finalizeCharacterCreation(userId, draft) {
    const { game_id } = draft;

    console.log(`🚀 Finalizing character for user ${userId} in game ${game_id}`);
    console.log('🧾 Draft data:', JSON.stringify(draft, null, 2));

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

    const statTemplates = await getStatTemplates(game_id);
    const statMap = {};
    for (const template of statTemplates) {
        const baseKey = `game:${template.id}`;
        if (template.field_type === 'count') {
            const meta = draft[`meta:${baseKey}`];
            if (meta?.max != null) {
                statMap[template.id] = {
                    value: null,
                    meta: {
                        current: meta.current ?? meta.max,
                        max: meta.max,
                    },
                };
            }
        } else if (draft[baseKey]) {
            statMap[template.id] = {
                value: draft[baseKey],
                meta: null,
            };
        }
    }

    console.log('>>> character_draft.service.js > finalizeCharacterCreation > character.id: ', character.id);
    console.log('>>> character_draft.service.js > finalizeCharacterCreation > statMap: ', statMap);

    await statFieldDAO.bulkUpsert(character.id, statMap);

    drafts.delete(getDraftKey(userId));
    console.log(`🗑️ Cleared draft for user ${userId}`);

    return character;
}

function purgeStaleDrafts() {
    const now = Date.now();
    for (const [key, { updatedAt }] of drafts.entries()) {
        if (now - updatedAt > STALE_TIMEOUT) {
            drafts.delete(key);
            console.log(`🧹 Purged stale draft: ${key}`);
        }
    }
}

setInterval(purgeStaleDrafts, 1000 * 60 * 5);

module.exports = {
    initDraft,
    upsertTempCharacterField,
    getTempCharacterData,
    getRemainingRequiredFields,
    isDraftComplete,
    finalizeCharacterCreation,
    purgeStaleDrafts,
};
