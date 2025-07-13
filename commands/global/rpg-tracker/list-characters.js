// commands/global/rpg-tracker/list-characters.js

const { SlashCommandBuilder } = require('discord.js');
const { getCharactersByGame } = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const { rebuildListCharactersResponse } = require('../../../features/rpg-tracker/utils/rebuild_list_characters_response');

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
            console.log('🧠 [list-characters] gameId:', gameId);

            if (!gameId) {
                return await interaction.reply({
                    content: '🎲 You must join or create a game first using `/create-game`.',
                    ephemeral: true,
                });
            }

            const allCharacters = await getCharactersByGame(gameId);
            console.log('📦 [list-characters] All characters in game:', allCharacters.map(c => ({
                id: c.id,
                name: c.name,
                visibility: c.visibility,
            })));

            // Filter only public characters
            const publicCharacters = allCharacters.filter(c => c.visibility === 'public');
            console.log('🔓 [list-characters] Public characters:', publicCharacters.map(c => c.name));

            if (!publicCharacters.length) {
                return await interaction.reply({
                    content: '📭 No public characters found in your current game.',
                    ephemeral: true,
                });
            }

            const { content, components } = await rebuildListCharactersResponse(publicCharacters, 0, userId, guildId);

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
