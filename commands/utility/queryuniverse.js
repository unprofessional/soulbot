const { SlashCommandBuilder } = require('discord.js');
const { queryWithRAG } = require('../../features/ollama/index.js');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';
module.exports = {
    data: new SlashCommandBuilder()
        .setName('queryuniverse')
        .setDescription('Query the dataset for relevant information.')
        .addStringOption(option =>
            option
                .setName('prompt')
                .setDescription('The query prompt to search the dataset with.')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        // Defer the reply to allow time for processing
        await interaction.deferReply();

        // Retrieve the user-provided prompt
        const userPrompt = interaction.options.getString('prompt');

        try {
            // Get metadata filters based on the interaction's context (e.g., guild and channel)
            // const guildId = interaction.guild?.id || null;
            // const channelId = interaction.channel?.id || null;

            // Perform the RAG-enhanced query
            // const response = await queryWithRAG(userPrompt, { guild_id: guildId, channel_id: channelId });
            const response = await queryWithRAG(userPrompt, {}); // No metadata filters for universal search

            const messageToShow = `**Request:**\n> ${userPrompt}\n\n**Response:**\n${response}`;

            // Send the LLM's response to the user
            if (response.length <= 2000) {
                await interaction.editReply(messageToShow);
            } else {
                // Handle responses longer than 2000 characters (Discord's limit)
                const chunks = response.match(/[\s\S]{1,1990}(?=\s|$)|[\s\S]{1,1990}/g);
                await interaction.editReply(chunks.shift()); // Send the first chunk
                for (const chunk of chunks) {
                    await interaction.followUp(chunk);
                }
            }
        } catch (error) {
            console.error('Error executing /query command:', error);

            // Inform the user about the error
            await interaction.editReply(
                'There was an error processing your query. Please try again later.'
            );
        }
    },
};
