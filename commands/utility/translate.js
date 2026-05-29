const { SlashCommandBuilder } = require('discord.js');
const PromiseQueue = require('../../lib/promise_queue');
const {
    getLanguageName,
    resolveLanguageCode,
    translateText,
} = require('../../features/twitter-core/translation_service.js');

const queue = new PromiseQueue(1, 60000);
const queueLimit = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text into a target language.')
        .addStringOption(option =>
            option
                .setName('source_language')
                .setDescription('Source language name or code, e.g. Portuguese or pt')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('target_language')
                .setDescription('Target language name or code, e.g. French or fr')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('text')
                .setDescription('The text to translate')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (queue.queue.length >= queueLimit) {
            return await interaction.reply({
                content: 'The bot is currently handling too many requests. Please try again later.',
                ephemeral: true,
            });
        }

        const sourceLanguageInput = interaction.options.getString('source_language');
        const targetLanguageInput = interaction.options.getString('target_language');
        const text = interaction.options.getString('text');
        const sourceLanguageCode = resolveLanguageCode(sourceLanguageInput);
        const targetLanguageCode = resolveLanguageCode(targetLanguageInput);

        if (!sourceLanguageCode) {
            return await interaction.reply({
                content: 'Unknown source language. Use a supported language name like `Portuguese` or a code like `pt`.',
                ephemeral: true,
            });
        }

        if (!targetLanguageCode) {
            return await interaction.reply({
                content: 'Unknown target language. Use a supported language name like `French` or a code like `fr`.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        try {
            const translatedText = await queue.add(() => translateText({
                text,
                sourceLanguage: sourceLanguageCode,
                targetLanguage: targetLanguageCode,
                log: (msg) => console.log('[TranslateCommand]', msg),
            }));

            const sourceLanguageName = getLanguageName(sourceLanguageCode);
            const targetLanguageName = getLanguageName(targetLanguageCode);
            const messageToShow = `**Translated from ${sourceLanguageName} (${sourceLanguageCode}) to ${targetLanguageName} (${targetLanguageCode}):**\n${translatedText}`;

            if (messageToShow.length <= 2000) {
                await interaction.editReply(messageToShow);
            } else {
                const chunks = messageToShow.match(/[\s\S]{1,1990}(?=\s|$)|[\s\S]{1,1990}/g) || [messageToShow];
                await interaction.editReply(chunks.shift());
                for (const chunk of chunks) {
                    await interaction.followUp(chunk);
                }
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                return await interaction.editReply({
                    content: 'Translation timed out. Please try again later.',
                });
            }

            console.error('Error processing translation command:', error, {
                user: interaction.user.id,
                command: interaction.commandName,
                sourceLanguageInput,
                targetLanguageInput,
            });

            return await interaction.editReply({
                content: 'There was an error translating your text. Please try again later.',
            });
        }
    },
};
