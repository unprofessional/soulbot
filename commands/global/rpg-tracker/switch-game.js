// commands/global/rpg-tracker/switch-game.js

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { getGamesByUser } = require('../../../store/services/game.service');
const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch-game')
        .setDescription('Select one of your games to make active.'),

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
            // Get all games the user owns or has created in this server
            const allGames = await getGamesByUser(userId, guildId);

            const accessibleGames = [];

            for (const game of allGames) {
                const { valid } = await validateGameAccess({ gameId: game.id, userId });
                if (valid) {
                    accessibleGames.push(game);
                }
            }

            if (!accessibleGames.length) {
                return await interaction.reply({
                    content: '⚠️ You have no accessible games in this server.',
                    ephemeral: true,
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('switchGameDropdown')
                .setPlaceholder('Choose your game')
                .addOptions(
                    accessibleGames.map(g => ({
                        label: g.name.slice(0, 100),
                        description: g.description?.slice(0, 90) || 'No description.',
                        value: g.id,
                    }))
                );

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.reply({
                content: '🎲 Choose your active game:',
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('[COMMAND ERROR] /switch-game:', err);
            await interaction.reply({
                content: '❌ Failed to display game switcher. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
