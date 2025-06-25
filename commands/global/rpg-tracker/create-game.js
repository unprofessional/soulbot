// commands/global/rpg-tracker/create-game.js

const { SlashCommandBuilder } = require('discord.js');
const { createGame } = require('../../../store/services/character.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-game')
        .setDescription('Creates a new RPG campaign for this server.')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('The name of your game/campaign')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('A short description of the game')
                .setRequired(false)
        ),

    async execute(interaction) {
        const name = interaction.options.getString('name')?.trim();
        const description = interaction.options.getString('description')?.trim() || null;
        const guildId = interaction.guild?.id;
        const userId = interaction.user.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used within a server.',
                ephemeral: true,
            });
        }

        try {
            const game = await createGame({
                name,
                description,
                createdBy: userId,
                guildId,
            });

            await interaction.reply({
                content: `✅ Created game **${game.name}** (ID: \`${game.id}\`)`,
                ephemeral: true,
            });
        } catch (err) {
            console.error('[COMMAND ERROR] /create-game:', err);
            await interaction.reply({
                content: '❌ Failed to create game. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
