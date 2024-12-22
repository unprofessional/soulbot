const { SlashCommandBuilder } = require('discord.js');
const { sendPromptToOllama } = require('../../features/ollama');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';

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
            const response = await sendPromptToOllama(userMessage);

            const messageToShow = `**You asked:**\n${userMessage}\n\n**The LLM replied:**\n${response}`;

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
            console.error('Error processing LLM message:', error, {
                user: interaction.user.id,
                command: interaction.commandName,
            });
            await interaction.editReply(
                'There was an error processing your message. Please try again later.'
            );
        }
    },
};
