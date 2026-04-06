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
                .setName('language')
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

        const targetLanguageInput = interaction.options.getString('language');
        const text = interaction.options.getString('text');
        const targetLanguageCode = resolveLanguageCode(targetLanguageInput);

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
                sourceLanguage: 'auto',
                targetLanguage: targetLanguageCode,
                log: (msg) => console.log('[TranslateCommand]', msg),
            }));

            const targetLanguageName = getLanguageName(targetLanguageCode);
            const messageToShow = `**Translated to ${targetLanguageName} (${targetLanguageCode}):**\n${translatedText}`;

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
                targetLanguageInput,
            });

            return await interaction.editReply({
                content: 'There was an error translating your text. Please try again later.',
            });
        }
    },
};
