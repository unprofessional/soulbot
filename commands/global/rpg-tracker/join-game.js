// commands/global/rpg-tracker/join-game.js

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getGame } = require('../../../store/services/game.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join-game')
        .setDescription('Select a public game in this server to join.'),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        if (!guildId) {
            return interaction.reply({
                content: '⚠️ You must use this command in a server (not DMs).',
                ephemeral: true,
            });
        }

        const games = await getGame({ guildId });

        // Filter out games that are:
        // 1. Not marked public
        // 2. Created by the current user (already the GM/player)
        const eligibleGames = games.filter(game =>
            game.is_public && game.created_by !== userId
        );

        if (!eligibleGames.length) {
            return interaction.reply({
                content: [
                    '📭 There are no joinable public games in this server right now.',
                    '',
                    'If you created a game, you’re already considered a player as the **Game Master**.',
                ].join('\n'),
                ephemeral: true,
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('joinGameDropdown')
            .setPlaceholder('Select a game to join')
            .addOptions(
                eligibleGames.slice(0, 25).map(game => ({
                    label: game.name.slice(0, 100),
                    description: game.description?.slice(0, 100) || 'No description',
                    value: game.id,
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({
            content: '🎲 Choose a game you want to join:',
            components: [row],
            ephemeral: true,
        });
    }
};
