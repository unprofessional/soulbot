const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('llm')
        .setDescription('Talks to the LLM, and has it talk back.'),
    async execute(interaction) {
        await interaction.reply('soon!');
    },
};
