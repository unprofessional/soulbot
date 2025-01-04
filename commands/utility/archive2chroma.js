const { SlashCommandBuilder } = require('discord.js');
const { archiveHistoryToChromaDb } = require('../../features/ollama/embed');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';
module.exports = {
    data: new SlashCommandBuilder()
        .setName('archive2chroma')
        .setDescription('Archives historical messages to ChromaDB.'),
    async execute(interaction) {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }
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
