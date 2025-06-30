// features/rpg-tracker/modal_handlers/character_creation_modals.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getOrCreatePlayer } = require('../../../store/services/player.service');
const { createCharacter, getUserDefinedFields } = require('../../../store/services/character.service');
const {
    getRemainingRequiredFields,
    upsertTempCharacterField,
    getTempCharacterData,
} = require('../../../store/services/character_draft.service');
const { getStatTemplates, getGame } = require('../../../store/services/game.service');
const { rebuildCreateCharacterResponse } = require('../../utils/rebuild_create_character_response');

/**
 * Handles modals related to character creation.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === Full Character Creation (Legacy Modal) ===
    if (customId.startsWith('createCharacterModal:')) {
        const [, gameId] = customId.split(':');

        try {
            if (!interaction.guildId) {
                return interaction.reply({
                    content: '⚠️ You must use this command in a server (not a DM).',
                    ephemeral: true,
                });
            }

            const player = await getOrCreatePlayer(interaction.user.id);
            if (!player?.current_game_id || player.current_game_id !== gameId) {
                return interaction.reply({
                    content: '⚠️ You must join the game before creating a character.',
                    ephemeral: true,
                });
            }

            const statTemplates = await getStatTemplates(gameId);
            if (!statTemplates.length) {
                return interaction.reply({
                    content: '⚠️ This game has no stat fields defined. Ask the GM to add some first.',
                    ephemeral: true,
                });
            }

            // Parse modal fields into structured data
            let name = 'Unnamed';
            let clazz = '';
            let race = '';
            let level = 1;
            let bio = '';
            let avatar_url = '';
            const statFields = {};

            for (const template of statTemplates) {
                const value = interaction.fields.getTextInputValue(template.id)?.trim() || '';
                const lowerLabel = template.label.toLowerCase();

                if (lowerLabel === 'name') name = value;
                else if (lowerLabel === 'class' || lowerLabel === 'role') clazz = value;
                else if (lowerLabel === 'race' || lowerLabel === 'origin') race = value;
                else if (lowerLabel === 'level') {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed)) level = parsed;
                } else if (lowerLabel === 'bio') bio = value;
                else if (lowerLabel === 'avatar url') avatar_url = value;

                statFields[template.id] = value;
            }

            if (!name || !clazz) {
                return interaction.reply({
                    content: '⚠️ Name and class are required.',
                    ephemeral: true,
                });
            }

            const character = await createCharacter({
                userId: interaction.user.id,
                gameId,
                name,
                clazz,
                race,
                level,
                bio,
                avatar_url,
                stats: statFields,
            });

            return interaction.reply({
                content: `✅ Character **${character.name}** created and joined your active game!`,
                ephemeral: true,
            });

        } catch (err) {
            console.error('Error in createCharacterModal:', err);
            return interaction.reply({
                content: '❌ Failed to create character. Please try again later.',
                ephemeral: true,
            });
        }
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

        const remaining = await getRemainingRequiredFields(interaction.user.id);

        // If complete, show submit button
        if (remaining.length === 0) {
            return interaction.replied || interaction.deferred
                ? interaction.editReply({
                    content: '✅ All required fields are filled! Submit when ready:',
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('submitNewCharacter')
                                .setLabel('Submit Character')
                                .setStyle(ButtonStyle.Success)
                        ),
                    ],
                    ephemeral: true,
                })
                : interaction.reply({
                    content: '✅ All required fields are filled! Submit when ready:',
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('submitNewCharacter')
                                .setLabel('Submit Character')
                                .setStyle(ButtonStyle.Success)
                        ),
                    ],
                    ephemeral: true,
                });
        }

        // Otherwise, rebuild full UX
        const statTemplates = await getStatTemplates(gameId);
        const userFields = await getUserDefinedFields(interaction.user.id);
        const game = await getGame({ id: gameId });

        const allFields = [
            { name: 'core:name', label: '[CORE] Name' },
            { name: 'core:bio', label: '[CORE] Bio' },
            { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
            { name: 'core:visibility', label: '[CORE] Visibility' },
            ...statTemplates.map(f => ({ name: `game:${f.id}`, label: `[GAME] ${f.label}` })),
            ...userFields.map(f => ({ name: `user:${f.name}`, label: `[USER] ${f.label || f.name}` })),
        ];

        const response = rebuildCreateCharacterResponse(game, statTemplates, userFields, allFields);

        return interaction.replied || interaction.deferred
            ? interaction.editReply({
                content: `✅ Saved **${label}**. Choose next field:`,
                ...response,
                ephemeral: true,
            })
            : interaction.reply({
                content: `✅ Saved **${label}**. Choose next field:`,
                ...response,
                ephemeral: true,
            });
    }
}

module.exports = { handle };
