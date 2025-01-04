const { SlashCommandBuilder } = require('discord.js');
const { archiveHistoryToChromaDb } = require('../../features/ollama/embed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('archive2chroma')
        .setDescription('Archives historical messages to ChromaDB.'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Call the archive function
            await archiveHistoryToChromaDb();

            await interaction.editReply('Successfully archived historical messages to ChromaDB.');
        } catch (error) {
            console.error('Error archiving historical data to ChromaDB:', error);

            await interaction.editReply(
                'There was an error archiving historical messages to ChromaDB. Please check the logs and try again later.'
            );
        }
    },
};
