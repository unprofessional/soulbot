const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

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
        const dropdown = new StringSelectMenuBuilder()
            .setCustomId('createCharacterDropdown')
            .setPlaceholder('Choose a character field to define')
            .addOptions(
                fieldOptions.map(f => {
                    const template = statTemplates.find(t => `game:${t.id}` === f.name);
                    const fieldType = template?.field_type;
                    return {
                        label: f.label,
                        value: `${f.name}|${f.label}${fieldType ? `|${fieldType}` : ''}`,
                    };
                })
            );
        components.push(new ActionRowBuilder().addComponents(dropdown));
    }

    // === Dropdown for EDITING completed fields (always if present) ===
    const allFields = [
        { name: 'core:name', label: '[CORE] Name' },
        { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
        { name: 'core:bio', label: '[CORE] Bio' },
        { name: 'core:visibility', label: '[CORE] Visibility' },
        ...statTemplates.flatMap(t =>
            t.field_type === 'count'
                ? [
                    { name: `game:${t.id}:max`, label: `[GAME] ${t.label} (Max)`, field_type: 'count' },
                    { name: `game:${t.id}:current`, label: `[GAME] ${t.label} (Current)`, field_type: 'count' },
                ]
                : [{ name: `game:${t.id}`, label: `[GAME] ${t.label}`, field_type: t.field_type }]
        ),
        ...userFields.map(f => ({
            name: `user:${f.name}`,
            label: `[USER] ${f.label || f.name}`,
        })),
    ];

    const filledFields = allFields.filter(f => {
        const val = draftData?.[f.name];
        return val && val.trim?.();
    });

    if (filledFields.length > 0) {
        const editDropdown = new StringSelectMenuBuilder()
            .setCustomId('editCharacterFieldDropdown')
            .setPlaceholder('📝 Edit a completed field')
            .addOptions(
                filledFields.map(f => ({
                    label: f.label,
                    value: `${f.name}|${f.label}${f.field_type ? `|${f.field_type}` : ''}`,
                }))
            );
        components.push(new ActionRowBuilder().addComponents(editDropdown));
    }

    const submitButton = new ButtonBuilder()
        .setCustomId('submitNewCharacter')
        .setLabel('✅ Submit Character')
        .setStyle(ButtonStyle.Success)
        .setDisabled(fieldOptions.length > 0);

    components.push(new ActionRowBuilder().addComponents(submitButton));

    return {
        content,
        components,
        embeds: [],
    };
}

module.exports = {
    rebuildCreateCharacterResponse,
};
