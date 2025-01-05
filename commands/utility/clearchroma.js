const { SlashCommandBuilder } = require('discord.js');
const { clearChromaDb } = require('../../features/ollama/clearChromaDb');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearchromadb')
        .setDescription('Clears ChromaDB of all collections or a specific collection.')
        .addStringOption(option =>
            option
                .setName('collection')
                .setDescription('The name of the collection to clear. Leave empty to clear all collections.')
                .setRequired(false)
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

        const collectionName = interaction.options.getString('collection'); // Get optional collection name

        try {
            if (collectionName) {
                // Clear the specified collection
                await clearChromaDb(collectionName);
                await interaction.editReply(`Collection **${collectionName}** has been cleared from ChromaDB.`);
            } else {
                // Clear all collections
                await clearChromaDb();
                await interaction.editReply('All collections have been cleared from ChromaDB.');
            }
        } catch (error) {
            console.error('Error clearing ChromaDB:', error);

            // Inform the user about the error
            await interaction.editReply(
                'There was an error clearing ChromaDB. Please check the logs for details.'
            );
        }
    },
};
