const { SlashCommandBuilder } = require('discord.js');
const { PromptTemplate } = require('@langchain/core/prompts');
const { sendPromptToOllama } = require('../../features/ollama');
const PromiseQueue = require('../../lib/promise_queue');
const cheerio = require('cheerio');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';
const queue = new PromiseQueue(1, 20000); // Max 1 concurrent task, 20 seconds timeout
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
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({
                content: 'You do not have permission to use this command.',
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

        const userMessage = interaction.options.getString('message');
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = userMessage.match(urlRegex);

        await interaction.deferReply();

        try {
            if(urls) {
                console.log('>>>>> llm > TEXT CONTAINS URL!!!');
                const urlContent = await fetchWebPageContent(urls[0]);
                console.log('>>>>> llm > urlContent: ', urlContent);

                // Create a structured summarization prompt
                const prompt = new PromptTemplate({
                    inputVariables: ['content', 'userPrompt'],
                    template: `Summarize the following webpage content:\`\`\`\n\n{content}\n\n\`\`\` and also obey the user prompt (if any): \`\`\`\n\n{userPrompt}\n\n\`\`\``,
                });

                const formattedPrompt = await prompt.format({ content: urlContent, userPrompt: userMessage });

                console.log('>>>>> llm > formattedPrompt: ', formattedPrompt);

                const response = await queue.add(() => sendPromptToOllama(formattedPrompt));

                const messageToShow = `**Request:**\n> ${userMessage}\n\n**Response:**\n${response}`;

                if (messageToShow.length <= 2000) {
                    await interaction.editReply(messageToShow);
                } else {
                    const chunks = messageToShow.match(/(.|[\r\n]){1,1990}(?=\s|$)/g);
                    await interaction.editReply(chunks.shift()); // Send the first chunk

                    for (const chunk of chunks) {
                        await interaction.followUp(chunk);
                    }
                }
            } else {
                console.log('>>>>> llm > NORMAL TEXT-BASED REQUEST!');
                console.log('Adding task to queue...');
                const response = await queue.add(() => sendPromptToOllama(userMessage));

                const messageToShow = `**Request:**\n> ${userMessage}\n\n**Response:**\n${response}`;

                if (messageToShow.length <= 2000) {
                    await interaction.editReply(messageToShow);
                } else {
                    const chunks = messageToShow.match(/(.|[\r\n]){1,1990}(?=\s|$)/g);
                    await interaction.editReply(chunks.shift()); // Send the first chunk

                    for (const chunk of chunks) {
                        await interaction.followUp(chunk);
                    }
                }
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

// Helper function to fetch webpage content using `fetch`
async function fetchWebPageContent(url) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();

        // Use Cheerio to parse HTML and extract content
        const $ = cheerio.load(html);

        // Select desired HTML elements
        const elements = $('p, span, h1, h2, h3, h4, h5, h6')
            .map((_, el) => $(el).text())
            .get();

        // Join and clean up text content
        return elements.join('\n').trim().substring(0, 20000); // Limit content to 20000 characters
    } catch (error) {
        console.error('Error fetching webpage content:', error);
        throw new Error('Could not fetch the webpage content.');
    }
}
