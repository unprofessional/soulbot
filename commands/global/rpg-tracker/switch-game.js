const { SlashCommandBuilder } = require('discord.js');
const { build } = require('../../../features/rpg-tracker/components/switch_game_selector');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch-game')
        .setDescription('Select one of your games to make active.'),

    async execute(interaction) {
        const { user, guild } = interaction;

        if (!guild) {
            return interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        const response = await build(user.id, guild.id);
        return interaction.reply(response);
    },
};
