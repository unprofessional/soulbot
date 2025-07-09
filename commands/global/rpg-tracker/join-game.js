// commands/global/rpg-tracker/join-game.js

const { SlashCommandBuilder } = require('discord.js');
const { build } = require('../../../features/rpg-tracker/components/join_game_selector');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join-game')
        .setDescription('Select a public game in this server to join.'),

    async execute(interaction) {
        const { user, guild } = interaction;

        if (!guild) {
            return interaction.reply({
                content: '⚠️ You must use this command in a server (not DMs).',
                ephemeral: true,
            });
        }

        const response = await build(user.id, guild.id);
        return interaction.reply(response);
    },
};
