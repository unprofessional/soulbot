const { SlashCommandBuilder } = require('discord.js');
const PromiseQueue = require('../../lib/promise_queue');
const { summarizeSingleMessage } = require('../../features/ollama');
const { getMessageById } = require('../../store/services/messages.service');

const summaryTimeoutMs = Number(process.env.SUMMARY_QUEUE_TIMEOUT_MS || 300000);
const queue = new PromiseQueue(1, summaryTimeoutMs);
const queueLimit = 3;

function getInteractionGuildId(interaction) {
    return interaction.guildId || interaction.guild?.id || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summarize-message')
        .setDescription('Summarizes a single stored message by ID.')
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The Discord message ID to summarize.')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (queue.queue.length >= queueLimit) {
            return await interaction.reply({
                content: 'The bot is currently handling too many requests. Please try again later.',
                ephemeral: true,
            });
        }

        const messageId = interaction.options.getString('message_id', true).trim();
        const guildId = getInteractionGuildId(interaction);

        await interaction.deferReply();

        try {
            const message = await getMessageById(messageId);
            if (!message || (guildId && message.guild_id !== guildId)) {
                await interaction.editReply('I could not find that message in this server.');
                return;
            }

            const response = await queue.add(() => summarizeSingleMessage(message));
            const messageToShow = `**Summary:**\n${response}`.trim();
            await interaction.editReply(messageToShow.slice(0, 2000));
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await interaction.editReply(
                    'The summary model is taking too long right now. Please try again later.'
                );
            } else {
                console.error('Error processing summarize-message request:', error, {
                    user: interaction.user.id,
                    guildId,
                    command: interaction.commandName,
                    messageId,
                });

                await interaction.editReply(
                    'There was an error summarizing that message. Please try again later.'
                );
            }
        }
    },
};
