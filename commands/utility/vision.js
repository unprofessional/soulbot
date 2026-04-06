const { SlashCommandBuilder } = require('discord.js');
const { fetchImageAsBase64 } = require('../../features/ollama/vision.js');
const { sendPromptToOllama } = require('../../features/ollama/index.js');
const { guildIsSupported } = require('../../store/guilds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vision')
        .setDescription('Analyze an image with the vision model.')
        .setDMPermission(false)
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('The image to analyze.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('prompt')
                .setDescription('Optional instructions for the image analysis.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('Vision mode to use.')
                .setRequired(false)
                .addChoices(
                    {
                        name: 'default',
                        value: 'default',
                    },
                    {
                        name: 'catvision',
                        value: 'catvision',
                    }
                )
        ),

    async execute(interaction) {
        if (!guildIsSupported(interaction.guildId)) {
            return interaction.reply({
                content: 'Server not supported!!',
                ephemeral: true,
            });
        }

        const image = interaction.options.getAttachment('image');
        const prompt = interaction.options.getString('prompt');
        const mode = interaction.options.getString('mode') || 'default';

        if (!image.contentType?.startsWith('image/')) {
            return interaction.reply({
                content: 'Please provide an image attachment.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        try {
            const base64Image = await fetchImageAsBase64(image.url);
            const result = await sendPromptToOllama(prompt, base64Image, mode);

            await interaction.editReply(
                mode === 'default' ? `Response:\n\n${result}` : result
            );
        } catch (error) {
            console.error('[vision command] Error:', error);
            await interaction.editReply('An error occurred while processing your image.');
        }
    },
};
