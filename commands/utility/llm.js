const { SlashCommandBuilder } = require('discord.js');
const { sendPromptToOllama } = require('../../features/ollama');

const BOT_OWNER_ID = '818606180095885332';

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
        // Check if the user is the bot owner
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true, // Makes the message visible only to the user
            });
        }

        // Get the value of the "message" option
        const userMessage = interaction.options.getString('message');

        try {
            // Process the user's message with the LLM
            const response = await sendPromptToOllama(userMessage);
            await interaction.reply(response);
        } catch (error) {
            console.error('Error processing LLM message:', error);
            await interaction.reply({
                content: 'There was an error processing your message.',
                ephemeral: true,
            });
        }
    },
};
