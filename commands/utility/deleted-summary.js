const { SlashCommandBuilder } = require('discord.js');
const PromiseQueue = require('../../lib/promise_queue');
const { summarizeDeletedMessages } = require('../../features/ollama');
const { getDeletedSummaryContext } = require('../../store/services/messages.service');

const queue = new PromiseQueue(1, 60000);
const queueLimit = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deleted-summary')
        .setDescription('Summarizes noteworthy deleted messages in this channel with recent chat context.'),
    async execute(interaction) {
        if (queue.queue.length >= queueLimit) {
            return await interaction.reply({
                content: 'The bot is currently handling too many requests. Please try again later.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();
        const channelId = interaction.channel.id;
        const deletedSummaryContext = await getDeletedSummaryContext({ channelId, limit: 50 });

        try {
            const response = await queue.add(() => summarizeDeletedMessages(deletedSummaryContext));
            const messageToShow = `**Deleted Summary:**\n${response}`;

            if (messageToShow.length <= 2000) {
                await interaction.editReply(messageToShow);
            } else {
                const chunks = messageToShow.match(/[\s\S]{1,1990}(?=\s|$)|[\s\S]{1,1990}/g);
                await interaction.editReply(chunks.shift());

                for (const chunk of chunks) {
                    await interaction.followUp(chunk);
                }
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await interaction.editReply(
                    'The bot is currently handling too many requests. Please try again later.'
                );
            } else {
                console.error('Error processing deleted-summary request:', error, {
                    user: interaction.user.id,
                    channelId: interaction.channel.id,
                    command: interaction.commandName,
                    deletedSummaryContext: {
                        ...deletedSummaryContext,
                        messages: deletedSummaryContext.messages.slice(0, 5),
                        deletedMessages: deletedSummaryContext.deletedMessages.slice(0, 5),
                    },
                });

                await interaction.editReply(
                    'There was an error processing your message. Please try again later.'
                );
            }
        }
    },
};
