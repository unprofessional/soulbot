// commands/global/rpg-tracker/list-games.js

const { SlashCommandBuilder } = require('discord.js');
const { getGame } = require('../../../store/services/game.service');
const { getCurrentGame } = require('../../../store/services/player.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list-games')
        .setDescription('Lists all games in this server with publish status.'),

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
            const games = await getGame({ guildId });

            if (!games?.length) {
                return await interaction.reply({
                    content: '📭 No games found in this server.',
                    ephemeral: true,
                });
            }

            // Get the user's current game in this server
            const currentGameId = await getCurrentGame(userId, guildId);

            const rows = games.map(game => {
                const isGM = game.created_by === userId;
                const visibility = game.is_public ? '✅ Public' : '🔒 Private';
                const creatorTag = isGM ? '🛠️ You are the GM' : '';
                const activeTag = game.id === currentGameId ? '⭐ Active' : '';

                const parts = [`• **${game.name}**`, visibility, creatorTag, activeTag].filter(Boolean);
                return parts.join(' — ');
            });

            await interaction.reply({
                content: `🎲 **Games in this server:**\n\n${rows.join('\n\n')}`, // Double newline between games
                ephemeral: true,
            });
        } catch (err) {
            console.error('[COMMAND ERROR] /list-games:', err);
            await interaction.reply({
                content: '❌ Failed to list games. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
