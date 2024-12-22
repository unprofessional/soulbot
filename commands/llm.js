const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('llm')
        .setDescription('Talks to the LLM, and has it talk back.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send to the LLM.')
                .setRequired(true) // Make it a required field
        ),
    async execute(interaction) {
        // Get the value of the "message" option
        const userMessage = interaction.options.getString('message');

        // Respond with the received message (you can replace this with LLM logic)
        await interaction.reply(`You said: ${userMessage}`);
    },
};
