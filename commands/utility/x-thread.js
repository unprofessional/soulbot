// commands/utility/x-thread.js

const { SlashCommandBuilder } = require('discord.js');
const PromiseQueue = require('../../lib/promise_queue');
const { handleThreadSnapshot } = require('../../features/twitter-core/thread_snapshot_handler');
const { sendInteractionWebhookProxy } = require('../../features/twitter-core/webhook_utils.js');
const { MediaDrainError } = require('../../app/media_work_registry.js');

const queue = new PromiseQueue(1, 60000); // 1 concurrent, 60s timeout
const queueLimit = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('x-thread')
        .setDescription('Render a Twitter/X thread as a snapshot.')
        .addStringOption(option =>
            option
                .setName('url')
                .setDescription('Paste a link to a tweet (mid-thread reply preferred)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const tweetUrl = interaction.options.getString('url');

        // Check for queue saturation
        if (queue.queue.length >= queueLimit) {
            return await interaction.reply({
                content: 'The bot is currently handling too many requests. Please try again later.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await queue.add(() => handleThreadSnapshot(tweetUrl));

            if (Buffer.isBuffer(result) || typeof result === 'string') {
                const files = Buffer.isBuffer(result)
                    ? [{ attachment: result, name: 'thread.png' }] : [];
                const longText = typeof result === 'string' && result.length > 2000;
                if (longText) files.push({ attachment: Buffer.from(result), name: 'thread.txt' });
                const content = Buffer.isBuffer(result) || longText ? `<${tweetUrl}>` : result;
                await sendInteractionWebhookProxy(interaction, content, { files, originalLink: tweetUrl });
                await interaction.deleteReply();
            } else {
                return await interaction.editReply({
                    content: 'Failed to render thread snapshot (invalid response type).',
                });
            }
        } catch (error) {
            if (error instanceof MediaDrainError || error?.name === 'MediaDrainError') {
                return await interaction.editReply({
                    content: 'The thread renderer is temporarily unavailable because the bot is restarting. Please try again shortly.',
                });
            }

            if (error.name === 'TimeoutError') {
                return await interaction.editReply({
                    content: `The thread renderer timed out. Please try again later.`,
                });
            }

            console.error('❌ /x-thread failed:', error);
            return await interaction.editReply({
                content: 'An error occurred while rendering the thread.',
            });
        }
    },
};
