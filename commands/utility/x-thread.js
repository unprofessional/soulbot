// commands/utility/x-thread.js

const { SlashCommandBuilder } = require('discord.js');
const PromiseQueue = require('../../lib/promise_queue');
const { handleThreadSnapshot } = require('../../features/twitter-core/thread_snapshot_handler');

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

        await interaction.deferReply();

        try {
            const result = await queue.add(() => handleThreadSnapshot(tweetUrl));

            if (Buffer.isBuffer(result)) {
                return await interaction.editReply({
                    files: [{ attachment: result, name: 'thread.png' }],
                });
            } else if (typeof result === 'string') {
                return await interaction.editReply({ content: result });
            } else {
                return await interaction.editReply({
                    content: 'Failed to render thread snapshot (invalid response type).',
                });
            }
        } catch (error) {
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
