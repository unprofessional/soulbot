// commands/utility/summary.js

const { SlashCommandBuilder } = require('discord.js');
const PromiseQueue = require('../../lib/promise_queue');
const { getSummaryContext } = require('../../store/services/messages.service');
const { summarizeChat } = require('../../features/ollama');
const { getDisabledReply, isGeneralLlmInferenceEnabled } = require('../../features/ollama/inference_gate.js');
const summaryTimeoutMs = Number(process.env.SUMMARY_QUEUE_TIMEOUT_MS || 300000);
const queue = new PromiseQueue(1, summaryTimeoutMs);
const queueLimit = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summary')
        .setDescription('Summarizes the last 100 messages in this channel.'),
    async execute(interaction) {
        if (!isGeneralLlmInferenceEnabled()) {
            return await interaction.reply({
                content: getDisabledReply(),
                ephemeral: true,
            });
        }

        // Check if the queue length exceeds the limit
        if (queue.queue.length >= queueLimit) {
            return await interaction.reply({
                content: 'The bot is currently handling too many requests. Please try again later.',
                ephemeral: true,
            });
        }
        await interaction.deferReply();
        const channelId = interaction.channel.id;
        const summaryContext = await getSummaryContext({ channelId, limit: 100 });
        // console.log('>>>>> summary > execute > summaryContext: ', summaryContext);

        try {
            const response = await queue.add(() => summarizeChat(summaryContext));
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
                await interaction.editReply(
                    'The summary model is taking too long right now. Please try again later.'
                );
            } else {
                console.error('Error processing LLM message:', error, {
                    user: interaction.user.id,
                    channelId: interaction.channel.id,
                    command: interaction.commandName,
                    summaryContext: {
                        ...summaryContext,
                        messages: summaryContext.messages.slice(0, 3),
                    },
                });
                
                await interaction.editReply(
                    'There was an error processing your message. Please try again later.'
                );
            }
        }
    },
};
