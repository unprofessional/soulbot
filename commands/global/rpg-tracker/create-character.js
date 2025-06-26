// commands/global/rpg-tracker/create-character.js

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getOrCreatePlayer, getCurrentGame } = require('../../../store/services/player.service');
const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { getUserDefinedFields } = require('../../../store/services/character.service');
const { initDraft } = require('../../../store/services/character_draft.service');

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

        // Ensure player link for this guild
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
        const userFields = await getUserDefinedFields(userId); // optional — can return []

        if (!statTemplates.length) {
            return interaction.reply({
                content: '⚠️ This game has no stat fields defined yet. Ask the GM to set them up.',
                ephemeral: true,
            });
        }

        // ✅ Initialize draft with game_id for validation
        const draft = initDraft(userId);
        draft.game_id = gameId;
        console.log(`🧾 Draft initialized for user ${userId} with game_id: ${gameId}`);

        // === Construct dropdown entries ===
        const coreFields = [
            { name: 'core:name', label: '[CORE] Name' },
            { name: 'core:bio', label: '[CORE] Bio' },
            { name: 'core:avatar_url', label: '[CORE] Avatar URL' },
            { name: 'core:visibility', label: '[CORE] Visibility' },
        ];
        const gameFields = (statTemplates || []).map(f => ({
            name: `game:${f.id}`,
            label: `[GAME] ${f.label || f.id}`,
        }));
        const userFieldsFormatted = (userFields || [])
            .filter(f => f?.name && typeof f.name === 'string')
            .map(f => ({
                name: `user:${f.name}`,
                label: `[USER] ${f.label || f.name}`,
            }));

        const allFields = [...coreFields, ...gameFields, ...userFieldsFormatted];

        // 🔍 Safety check for invalid entries
        const invalidFields = allFields.filter(f => !f.label || !f.name);
        if (invalidFields.length > 0) {
            console.warn('[create-character] Skipping invalid fields:', invalidFields);
        }

        const safeFields = allFields.filter(f =>
            typeof f.label === 'string' &&
            typeof f.name === 'string' &&
            f.label.trim() &&
            f.name.trim()
        );

        if (!safeFields.length) {
            return interaction.reply({
                content: '⚠️ No valid fields found to show in the dropdown.',
                ephemeral: true,
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('createCharacterDropdown')
            .setPlaceholder('Choose a character field to define')
            .addOptions(
                safeFields.map(f => ({
                    label: f.label,
                    value: f.name,
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        return await interaction.reply({
            content: '🧬 Select a field to begin character creation:',
            components: [row],
            ephemeral: true,
        });
    },
};
