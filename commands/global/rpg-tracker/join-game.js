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

        // Filter out games that are either:
        // 1. Created by the user (GM)
        // 2. Not marked public
        const eligibleGames = games.filter(game =>
            game.created_by !== userId && game.is_public === true
        );

        if (!eligibleGames.length) {
            return interaction.reply({
                content: '⚠️ There are no joinable public games in this server. You cannot join a game you created.',
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
