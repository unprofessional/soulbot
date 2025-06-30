// commands/global/rpg-tracker/view-character.js

const { SlashCommandBuilder } = require('discord.js');
const {
    getCharactersByUser,
    getCharacterWithStats,
} = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../../../features/rpg-tracker/embed_utils');
const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-character')
        .setDescription("View your character's stats for this game's campaign."),

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
            const currentGameId = await getCurrentGame(userId, guildId);

            if (!currentGameId) {
                return await interaction.reply({
                    content: '⚠️ No active game found. Use `/switch-game` or `/join-game` to select one.',
                    ephemeral: true,
                });
            }

            // ✅ FIXED: use `guildId` instead of `currentGameId`
            const allCharacters = await getCharactersByUser(userId, guildId);

            if (!allCharacters.length) {
                return await interaction.reply({
                    content: '⚠️ No character found. Use `/create-character` to start one.',
                    ephemeral: true,
                });
            }

            const character = allCharacters[0];
            const full = await getCharacterWithStats(character.id);

            const { warning } = await validateGameAccess({ gameId: full.game_id, userId });

            const embed = buildCharacterEmbed(full);
            const row = buildCharacterActionRow(character.id);

            await interaction.reply({
                content: warning || undefined,
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('[COMMAND ERROR] /view-character:', err);
            await interaction.reply({
                content: '❌ Failed to retrieve character. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
