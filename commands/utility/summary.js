const { SlashCommandBuilder } = require('discord.js');
const PromiseQueue = require('../../lib/promise_queue');
const { getMessages } = require('../../store/services/messages.service');
const { summarizeChat } = require('../../features/ollama');
const queue = new PromiseQueue(1, 20000); // Max 1 concurrent task, 20 seconds timeout
const queueLimit = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summary')
        .setDescription('Summarizes the last 100 messages in this channel.'),
    async execute(interaction) {
        // Check if the queue length exceeds the limit
        if (queue.queue.length >= queueLimit) {
            return await interaction.reply({
                content: 'The bot is currently handling too many requests. Please try again later.',
                ephemeral: true,
            });
        }
        await interaction.deferReply();
        const channelId = interaction.channel.id;
        const messages = await getMessages({ channelId, limit: 100 });
        // console.log('>>>>> summary > execute > messages: ', messages);

        try {
            const response = await queue.add(() => summarizeChat(messages));
            const messageToShow = `**Summary:**\n${response}`;
            if (messageToShow.length <= 2000) {
                await interaction.editReply(messageToShow);
            } else {
                const chunks = messageToShow.match(/[\s\S]{1,1990}(?=\s|$)|[\s\S]{1,1990}/g);
                await interaction.editReply(chunks.shift()); // Send the first chunk

                for (const chunk of chunks) {
                    await interaction.followUp(chunk);
                }
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await interaction.reply({
                    content: `The bot is currently handling too many requests. Please try again in ${Math.ceil(queueLimit * 20)} seconds.`,
                    ephemeral: true,
                });                
            } else {
                console.error('Error processing LLM message:', error, {
                    user: interaction.user.id,
                    channelId: interaction.channel.id,
                    command: interaction.commandName,
                    inputMessages: messages.slice(0, 3), // Log a few messages for context
                });
                
                await interaction.editReply(
                    'There was an error processing your message. Please try again later.'
                );
            }
        }
    },
};
