// commands/global/rpg-tracker/list-characters.js

const { SlashCommandBuilder } = require('discord.js');
const { getCharactersByGame } = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const { rebuildCreateCharacterResponse } = require('../../../features/rpg-tracker/utils/rebuild_create_character_response');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list-characters')
        .setDescription('Lists all public characters in your current game.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        try {
            const gameId = await getCurrentGame(userId, guildId);

            if (!gameId) {
                return await interaction.reply({
                    content: '🎲 You must join or create a game first using `/create-game`.',
                    ephemeral: true,
                });
            }

            const allCharacters = await getCharactersByGame(gameId);

            // Filter only public characters
            const publicCharacters = allCharacters.filter(c => c.meta?.visibility === 'Public');

            if (!publicCharacters.length) {
                return await interaction.reply({
                    content: '📭 No public characters found in your current game.',
                    ephemeral: true,
                });
            }

            const { content, components } = rebuildCreateCharacterResponse(publicCharacters, 0);

            await interaction.reply({
                content,
                components,
                ephemeral: true,
            });
        } catch (err) {
            console.error('[COMMAND ERROR] /list-characters:', err);
            await interaction.reply({
                content: '❌ Failed to list characters. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
