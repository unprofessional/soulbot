// commands/utility/llm.js

const { SlashCommandBuilder } = require('discord.js');
const cheerio = require('cheerio');
const {
    replyWithLlmContext,
    summarizeLlmMemory,
} = require('../../features/ollama');
const PromiseQueue = require('../../lib/promise_queue');
const { getLlmMemorySummary, saveLlmMemorySummary } = require('../../store/services/llm_memory.service.js');
const { getLlmChannelContext } = require('../../store/services/messages.service');

// const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';
const queue = new PromiseQueue(1, 60000); // Max 1 concurrent task, 20 seconds timeout
const queueLimit = 3;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('llm')
        .setDescription('Talks to the LLM, and has it talk back.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send to the LLM.')
                .setRequired(true)
        ),
    async execute(interaction) {
        // if (interaction.user.id !== BOT_OWNER_ID) {
        //     return await interaction.reply({
        //         content: 'You do not have permission to use this command.',
        //         ephemeral: true,
        //     });
        // }

        if (queue.queue.length >= queueLimit) {
            return await interaction.reply({
                content: 'The bot is currently handling too many requests. Please try again later.',
                ephemeral: true,
            });
        }

        const userMessage = interaction.options.getString('message');
        const memberId = interaction.user.id;
        const channelId = interaction.channel.id;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = userMessage.match(urlRegex);

        await interaction.deferReply();

        try {
            console.log('>>>>> llm > contextual request');

            const [memorySummary, channelMessages, webpageContent] = await Promise.all([
                getLlmMemorySummary({ memberId, channelId }),
                getLlmChannelContext({ channelId, limit: 50 }),
                urls ? fetchWebPageContent(urls[0]) : Promise.resolve(null),
            ]);

            const response = await queue.add(() => replyWithLlmContext({
                userId: memberId,
                userPrompt: userMessage,
                memorySummary,
                channelMessages,
                webpageContent,
            }));

            const messageToShow = `**Request:**\n> ${userMessage}\n\n**Response:**\n${response}`
                .replace(/<think>\s*<\/think>\s*/gi, '')
                .trim();

            if (messageToShow.length <= 2000) {
                await interaction.editReply(messageToShow);
            } else {
                const chunks = messageToShow.match(/(.|[\r\n]){1,1990}(?=\s|$)/g);
                await interaction.editReply(chunks.shift());

                for (const chunk of chunks) {
                    await interaction.followUp(chunk);
                }
            }

            try {
                const nextMemorySummary = await queue.add(() => summarizeLlmMemory({
                    previousSummary: memorySummary,
                    userPrompt: userMessage,
                    assistantResponse: response,
                }));

                await saveLlmMemorySummary({
                    memberId,
                    channelId,
                    summary: nextMemorySummary,
                });
            } catch (memoryError) {
                console.error('Error updating /llm memory summary:', memoryError, {
                    user: memberId,
                    channelId,
                });
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                await interaction.editReply(
                    'The bot is currently handling too many requests. Please try again later.'
                );
            } else {
                console.error('Error processing LLM message:', error, {
                    user: interaction.user.id,
                    command: interaction.commandName,
                });
                await interaction.editReply(
                    'There was an error processing your message. Please try again later.'
                );
            }
        }
    },
};

async function fetchWebPageContent(url) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const elements = $('p, h1, h2, h3, h4, h5, h6')
            .map((_, el) => $(el).text())
            .get();

        return elements.join('\n').trim().substring(0, 20000);
    } catch (error) {
        console.error('Error fetching webpage content:', error);
        throw new Error('Could not fetch the webpage content.');
    }
}
