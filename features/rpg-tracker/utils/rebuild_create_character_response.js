// features/rpg-tracker/utils/rebuild_create_character_response.js

const {
    build: rebuildFieldSelector,
} = require('../components/character_field_selector');
const {
    build: rebuildEditFieldSelector,
} = require('../components/edit_character_field_selector');
const {
    build: buildSubmitCharacterButton,
} = require('../components/submit_character_button');

/**
 * Truncates long field values for display (max 40 chars).
 */
function summarize(value, max = 40) {
    if (!value) return '';
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/**
 * Constructs the character creation content message.
 */
function buildCreateCharacterMessage(game, statTemplates = [], userFields = [], draftData = {}, fieldOptions = []) {
    const lines = [];

    lines.push(`# 🧬 Create Character for **${game.name}**`);
    if (game.description?.trim()) {
        const desc = game.description.trim().slice(0, 200);
        lines.push(`> ${desc}${game.description.length > 200 ? '…' : ''}`);
    }

    lines.push('');
    lines.push(`**CORE Fields:**`);

    const coreFields = ['core:name', 'core:avatar_url', 'core:bio'];

    for (const key of coreFields) {
        const value = draftData[key];
        const label = key.split(':')[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (value && value.toString().trim()) {
            lines.push(`- [CORE] ${label} 🟢 ${summarize(value.toString())}`);
        } else {
            lines.push(`- [CORE] ${label}`);
        }
    }

    lines.push('');

    if (statTemplates.length) {
        lines.push(`**GAME Fields:**`);
        for (const t of statTemplates) {
            const fieldKey = `game:${t.id}`;
            let filled = false;
            let display = '';

            if (t.field_type === 'count') {
                const meta = draftData[`meta:${fieldKey}`];
                if (meta?.max != null) {
                    filled = true;
                    display = `${meta.current ?? meta.max} / ${meta.max}`;
                }
            } else {
                const value = draftData[fieldKey];
                if (value && value.toString().trim()) {
                    filled = true;
                    display = summarize(value.toString());
                }
            }

            lines.push(`- [GAME] ${t.label}${filled ? ` 🟢 ${display}` : ''}`);
        }
    } else {
        lines.push(`🟨 _GM has not defined any game stat fields yet._`);
    }

    if (userFields.length) {
        lines.push('');
        lines.push(`**[USER] Custom Fields:**`);
        for (const f of userFields) {
            const key = `user:${f.name}`;
            const value = draftData[key];
            const label = f.label || f.name;
            if (value && value.toString().trim()) {
                lines.push(`- [USER] ${label} 🟢 ${summarize(value.toString())}`);
            } else {
                lines.push(`- [USER] ${label}`);
            }
        }
    }

    lines.push('');
    if (fieldOptions.length > 0) {
        lines.push(`ALL above fields MUST be filled out before you can submit your character!`);
        lines.push('');
        lines.push(`Use the dropdown below to continue filling out the required fields.`);
        lines.push('');
    } else {
        lines.push(`✅ All required fields are filled! You can now submit your character.`);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Rebuilds the character creation message with dropdown and buttons.
 */
function rebuildCreateCharacterResponse(game, statTemplates, userFields, fieldOptions, draftData = {}) {
    const content = buildCreateCharacterMessage(game, statTemplates, userFields, draftData, fieldOptions);

    const components = [];

    // === Dropdown for fields NOT yet filled ===
    if (fieldOptions.length > 0) {
        components.push(rebuildFieldSelector(fieldOptions, statTemplates));
    }

    // === Dropdown for EDITING completed fields ===
    const allFields = [
        { name: 'core:name', label: '[CORE] Name' },
        { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
        { name: 'core:bio', label: '[CORE] Bio' },
        // intentionally omitting core:visibility
        ...statTemplates.map(t => ({
            name: `game:${t.id}`,
            label: `[GAME] ${t.label}`,
            field_type: t.field_type,
        })),
        ...userFields.map(f => ({
            name: `user:${f.name}`,
            label: `[USER] ${f.label || f.name}`,
        })),
    ];

    const editDropdown = rebuildEditFieldSelector(allFields, draftData);
    if (editDropdown) {
        components.push(editDropdown);
    }

    // === Submit button ===
    const submitRow = buildSubmitCharacterButton(fieldOptions.length > 0);
    components.push(submitRow);

    return {
        content,
        components,
        embeds: [],
    };
}

module.exports = {
    rebuildCreateCharacterResponse,
};
