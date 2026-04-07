const { SlashCommandBuilder, DiscordAPIError } = require('discord.js');
const { extractMediaFromTweetUrl } = require('../../features/twitter-core/extract_media.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('explode-tweet')
        .setDescription('Upload a tweet/X post\'s media, text, and date without an embed.')
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('url')
                .setDescription('Paste a Twitter/X post URL.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const rawUrl = interaction.options.getString('url');

        await interaction.deferReply();

        try {
            const result = await extractMediaFromTweetUrl(
                rawUrl,
                (msg) => console.log('[extract-media]', msg)
            );

            if (!result.ok) {
                const content = result.fallbackLink
                    ? `${result.message}\n${result.fallbackLink}`
                    : result.message;

                return await interaction.editReply({ content });
            }

            return await interaction.editReply({
                content: result.content,
                files: result.files,
            });
        } catch (error) {
            console.error('❌ /extract-media failed:', error);

            if (error instanceof DiscordAPIError && error.code === 40005) {
                return await interaction.editReply({
                    content: 'Discord rejected one or more uploads because they were too large for this server.',
                });
            }

            return await interaction.editReply({
                content: 'An error occurred while extracting media from that post.',
            });
        }
    },
};
