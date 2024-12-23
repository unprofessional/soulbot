const { SlashCommandBuilder } = require('discord.js');
const { sendPromptToOllama } = require('../../features/ollama');
const PromiseQueue = require('../../lib/promise_queue');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';
const queue = new PromiseQueue(1, 5000); // Max 3 concurrent tasks, 5 seconds timeout

module.exports = {
    data: new SlashCommandBuilder()
        .setName('llm')
        .setDescription('Talks to the LLM, and has it talk back.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send to the LLM.')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const userMessage = interaction.options.getString('message');

        try {
            // Add the task to the queue
            const response = await queue.add(() =>
                sendPromptToOllama(userMessage)
            );

            const messageToShow = `**Request:**\n> ${userMessage}\n\n**Response:**\n${response}`;

            if (messageToShow.length <= 2000) {
                await interaction.editReply(messageToShow);
            } else {
                const chunks = messageToShow.match(/(.|[\r\n]){1,1990}(?=\s|$)/g);
                await interaction.editReply(chunks.shift()); // Send the first chunk

                for (const chunk of chunks) {
                    await interaction.followUp(chunk);
                }
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                // Inform the user that the queue is full
                await interaction.editReply(
                    'The bot is currently handling too many requests. Please try again later.'
                );
            } else {
                console.error('Error processing LLM message:', error, {
                    user: interaction.user.id,
                    command: interaction.commandName,
                });
                await interaction.editReply(
                    'There was an error processing your message. Please try again later.'
                );
            }
        }
    },
};
