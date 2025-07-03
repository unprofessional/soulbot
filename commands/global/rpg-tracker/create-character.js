// commands/global/rpg-tracker/create-character.js

const { SlashCommandBuilder } = require('discord.js');

const { getOrCreatePlayer, getCurrentGame } = require('../../../store/services/player.service');
const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { getUserDefinedFields } = require('../../../store/services/character.service');
const { initDraft, getTempCharacterData } = require('../../../store/services/character_draft.service');
const { rebuildCreateCharacterResponse } = require('../../../features/rpg-tracker/utils/rebuild_create_character_response');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-character')
        .setDescription('Create a character for your current game.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        if (!guildId) {
            return interaction.reply({
                content: '⚠️ You must use this command in a server.',
                ephemeral: true,
            });
        }

        await getOrCreatePlayer(userId, guildId);
        const gameId = await getCurrentGame(userId, guildId);

        if (!gameId) {
            return interaction.reply({
                content: '⚠️ You haven’t joined a game yet. Use `/join-game` to select one.',
                ephemeral: true,
            });
        }

        const game = await getGame({ id: gameId });
        if (!game) {
            return interaction.reply({
                content: '⚠️ Your currently joined game no longer exists.',
                ephemeral: true,
            });
        }

        if (!game.is_public && game.created_by !== userId) {
            return interaction.reply({
                content: '⚠️ This game is no longer public. You must ask the GM to republish it or invite you.',
                ephemeral: true,
            });
        }

        const statTemplates = await getStatTemplates(gameId);
        const userFields = await getUserDefinedFields(userId);

        if (!statTemplates.length) {
            return interaction.reply({
                content: '⚠️ This game has no stat fields defined yet. Ask the GM to set them up.',
                ephemeral: true,
            });
        }

        const existingDraft = await getTempCharacterData(userId);
        const draft = initDraft(userId);
        draft.game_id = gameId;

        console.log(`🧾 Draft initialized for user ${userId} with game_id: ${gameId}`);

        const coreFields = [
            { name: 'core:name', label: '[CORE] Name' },
            { name: 'core:bio', label: '[CORE] Bio' },
            { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
        ];

        // const gameFields = statTemplates.flatMap(f => {
        //     if (f.field_type === 'count') {
        //         return [
        //             { name: `game:${f.id}:max`, label: `[GAME] ${f.label} (Max)` },
        //             { name: `game:${f.id}:current`, label: `[GAME] ${f.label} (Current, optional)` },
        //         ];
        //     } else {
        //         return [{ name: `game:${f.id}`, label: `[GAME] ${f.label || f.id}` }];
        //     }
        // });

        const gameFields = statTemplates.map(f => {
            const name = `game:${f.id}`;
            const label = `[GAME] ${f.label || f.id}`;
            return { name, label };
        });

        const userFieldsFormatted = userFields
            .filter(f => f?.name && typeof f.name === 'string')
            .map(f => ({
                name: `user:${f.name}`,
                label: `[USER] ${f.label || f.name}`,
            }));

        const allFields = [...coreFields, ...gameFields, ...userFieldsFormatted];

        const safeFields = allFields.filter(f =>
            typeof f.label === 'string' &&
            typeof f.name === 'string' &&
            f.label.trim() &&
            f.name.trim() &&
            f.name.includes(':')
        );

        if (!safeFields.length) {
            return interaction.reply({
                content: '⚠️ No valid fields found to show in the dropdown.',
                ephemeral: true,
            });
        }

        const hydratedDraft = await getTempCharacterData(userId);
        const response = rebuildCreateCharacterResponse(game, statTemplates, userFields, safeFields, hydratedDraft);

        return await interaction.reply({
            ...response,
            content: existingDraft
                ? `⚠️ Resumed your previous draft!\nContinue filling in the fields below.\n\n${response.content || ''}`
                : response.content,
            ephemeral: true,
        });
    },
};
