// commands/global/rpg-tracker/create-character.js

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const { getOrCreatePlayer } = require('../../../store/services/player.service');
const { getGame, getStatTemplates } = require('../../../store/services/game.service');
const { getUserDefinedFields } = require('../../../store/services/character.service');

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

        const player = await getOrCreatePlayer(userId);
        const gameId = player?.current_game_id;

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

        // Construct dropdown entries
        const coreFields = [
            { name: 'name', label: '[CORE] Name' },
            { name: 'bio', label: '[CORE] Bio' },
            { name: 'avatar_url', label: '[CORE] Avatar URL' },
            { name: 'visibility', label: '[CORE] Visibility' },
        ];

        const gameFields = statTemplates.map(f => ({
            name: f.name,
            label: `[GAME] ${f.label || f.name}`,
        }));

        const userFieldsFormatted = (userFields || []).map(f => ({
            name: f.name,
            label: `[USER] ${f.label || f.name}`,
        }));

        const allFields = [...coreFields, ...gameFields, ...userFieldsFormatted];

        const menu = new StringSelectMenuBuilder()
            .setCustomId('createCharacterDropdown')
            .setPlaceholder('Choose a character field to define')
            .addOptions(
                allFields.map(f => ({
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
