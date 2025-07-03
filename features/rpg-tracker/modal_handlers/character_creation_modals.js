const { getOrCreatePlayer } = require('../../../store/services/player.service');
const { getUserDefinedFields } = require('../../../store/services/character.service');
const {
    getRemainingRequiredFields,
    upsertTempCharacterField,
    getTempCharacterData,
} = require('../../../store/services/character_draft.service');
const { getStatTemplates, getGame } = require('../../../store/services/game.service');
const { rebuildCreateCharacterResponse } = require('../utils/rebuild_create_character_response');

async function processCharacterFieldModal(interaction, fieldKey, label, value) {
    const draft = await getTempCharacterData(interaction.user.id);
    const gameId = draft?.game_id || null;

    if (!gameId) {
        return interaction.reply({
            content: '⚠️ Your draft session is invalid or expired.',
            ephemeral: true,
        });
    }

    const statTemplates = await getStatTemplates(gameId);
    const matchingTemplate = statTemplates.find(t => `game:${t.id}` === fieldKey);

    if (matchingTemplate?.field_type === 'count') {
        const maxRaw = interaction.fields.getTextInputValue(`${fieldKey}:max`)?.trim();
        const currentRaw = interaction.fields.getTextInputValue(`${fieldKey}:current`)?.trim();

        const max = parseInt(maxRaw, 10);
        const current = currentRaw ? parseInt(currentRaw, 10) : max;

        if (isNaN(max)) {
            return interaction.reply({
                content: '⚠️ Max value must be a number.',
                ephemeral: true,
            });
        }

        const meta = {
            current: isNaN(current) ? max : current,
            max,
        };

        // Store value as null and data in meta
        await upsertTempCharacterField(interaction.user.id, fieldKey, null, gameId, meta);
    } else {
        await upsertTempCharacterField(interaction.user.id, fieldKey, value, gameId);
    }

    const userFields = await getUserDefinedFields(interaction.user.id);
    const game = await getGame({ id: gameId });
    const remaining = await getRemainingRequiredFields(interaction.user.id);

    const allFields = [
        { name: 'core:name', label: '[CORE] Name' },
        { name: 'core:bio', label: '[CORE] Bio' },
        { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
        ...statTemplates.map(f => ({ name: `game:${f.id}`, label: `[GAME] ${f.label}` })),
        ...userFields.map(f => ({ name: `user:${f.name}`, label: `[USER] ${f.label || f.name}` })),
    ];

    const incompleteFields = allFields.filter(f => {
        const val = draft?.[f.name];
        return !val || !val.trim();
    });

    const response = rebuildCreateCharacterResponse(
        game,
        statTemplates,
        userFields,
        incompleteFields,
        draft
    );

    return interaction.update({
        ...response,
        content: remaining.length === 0
            ? `✅ All required fields are filled! Submit when ready:\n\n${response.content}`
            : `✅ Saved **${label}**. Choose next field:\n\n${response.content}`,
    });
}

/**
 * Handles modals related to character creation.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    let prefix = '';
    if (customId.startsWith('createDraftCharacterField:')) {
        prefix = 'createDraftCharacterField:';
    } else if (customId.startsWith('setCharacterField:')) {
        prefix = 'setCharacterField:';
    }

    if (prefix) {
        const combined = customId.slice(prefix.length);
        const [fieldKey, labelRaw] = combined.split('|');
        const label = labelRaw || fieldKey;

        console.log(`[${prefix}] fieldKey:`, fieldKey);
        console.log(`[${prefix}] label:`, label);

        if (!fieldKey || !fieldKey.includes(':')) {
            return interaction.reply({
                content: '⚠️ Invalid field key. Please restart character creation.',
                ephemeral: true,
            });
        }

        try {
            const draft = await getTempCharacterData(interaction.user.id);
            const gameId = draft?.game_id || null;

            if (!gameId) {
                return interaction.reply({
                    content: '⚠️ Your draft session is invalid or expired.',
                    ephemeral: true,
                });
            }

            const statTemplates = await getStatTemplates(gameId);
            const matchingTemplate = statTemplates.find(t => `game:${t.id}` === fieldKey);

            let value = null;
            if (matchingTemplate?.field_type !== 'count') {
                value = interaction.fields.getTextInputValue(fieldKey)?.trim();
                if (!value) {
                    return interaction.reply({
                        content: '⚠️ No value was entered.',
                        ephemeral: true,
                    });
                }
            }

            await getOrCreatePlayer(interaction.user.id, interaction.guildId);
            return await processCharacterFieldModal(interaction, fieldKey, label, value);
        } catch (err) {
            console.error(`[${prefix}] Error accessing field "${fieldKey}":`, err);
            return interaction.reply({
                content: `❌ Unable to find or parse field \`${fieldKey}\`. Please restart character creation.`,
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
