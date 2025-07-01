// features/rpg-tracker/modal_handlers/character_creation_modals.js

const { getOrCreatePlayer } = require('../../../store/services/player.service');
const { createCharacter, getUserDefinedFields } = require('../../../store/services/character.service');
const {
    getRemainingRequiredFields,
    upsertTempCharacterField,
    getTempCharacterData,
} = require('../../../store/services/character_draft.service');
const { getStatTemplates, getGame } = require('../../../store/services/game.service');
const { rebuildCreateCharacterResponse } = require('../utils/rebuild_create_character_response');

/**
 * Handles modals related to character creation.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    if (customId.startsWith('createDraftCharacterField:')) {
        const combined = customId.split(':').slice(1).join(':');
        const [fieldKey, labelRaw] = combined.split('|');
        const label = labelRaw || fieldKey;

        console.log('[createDraftCharacterField] fieldKey:', fieldKey);
        console.log('[createDraftCharacterField] label:', label);

        if (!fieldKey || !fieldKey.includes(':')) {
            return interaction.reply({
                content: '⚠️ Invalid field key. Please restart character creation.',
                ephemeral: true,
            });
        }

        let value;
        try {
            value = interaction.fields.getTextInputValue(fieldKey)?.trim();
        } catch (err) {
            console.error(`[createDraftCharacterField] Error accessing field "${fieldKey}":`, err);
            return interaction.reply({
                content: `❌ Unable to find or parse field \`${fieldKey}\`. Please restart character creation.`,
                ephemeral: true,
            });
        }

        if (!value) {
            return interaction.reply({
                content: '⚠️ No value was entered.',
                ephemeral: true,
            });
        }

        const draft = await getTempCharacterData(interaction.user.id);
        const gameId = draft?.game_id || null;

        if (!gameId) {
            return interaction.reply({
                content: '⚠️ Your draft session is invalid or expired.',
                ephemeral: true,
            });
        }

        await getOrCreatePlayer(interaction.user.id, interaction.guildId); // ✅ fix
        await upsertTempCharacterField(interaction.user.id, fieldKey, value, gameId);

        const statTemplates = await getStatTemplates(gameId);
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

    // === Single-Field Character Entry via Modal ===
    if (customId.startsWith('setCharacterField:')) {
        const combined = customId.split(':').slice(1).join(':');
        const [fieldKey, labelRaw] = combined.split('|');
        const label = labelRaw || fieldKey;

        console.log('[SetCharacterFieldModal] full customId:', customId);
        console.log('[SetCharacterFieldModal] fieldKey:', fieldKey);
        console.log('[SetCharacterFieldModal] label:', label);

        if (!fieldKey || !fieldKey.includes(':')) {
            console.warn('[SetCharacterFieldModal] Invalid or missing fieldKey:', fieldKey);
            return interaction.reply({
                content: '⚠️ Invalid field key. Please restart character creation.',
                ephemeral: true,
            });
        }

        let value;
        try {
            value = interaction.fields.getTextInputValue(fieldKey)?.trim();
        } catch (err) {
            console.error(`[SetCharacterFieldModal] Error accessing field "${fieldKey}":`, err);
            return interaction.reply({
                content: `❌ Unable to find or parse field \`${fieldKey}\`. Please restart character creation.`,
                ephemeral: true,
            });
        }

        if (!value) {
            return interaction.reply({
                content: '⚠️ No value was entered.',
                ephemeral: true,
            });
        }

        const draft = await getTempCharacterData(interaction.user.id);
        const gameId = draft?.game_id || null;
        if (!gameId) {
            return interaction.reply({
                content: '⚠️ Your draft session is invalid or expired.',
                ephemeral: true,
            });
        }

        await upsertTempCharacterField(interaction.user.id, fieldKey, value, gameId);

        const statTemplates = await getStatTemplates(gameId);
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

}

module.exports = { handle };
