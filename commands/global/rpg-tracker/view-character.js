// commands/global/rpg-tracker/view-character.js

const { SlashCommandBuilder } = require('discord.js');

const {
    getCharactersByUser,
    getCharacterWithStats,
} = require('../../../store/services/character.service');

const {
    getCurrentGame,
    getCurrentCharacter,
} = require('../../../store/services/player.service');

const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');
const { build: buildCharacterCard } = require('../../../features/rpg-tracker/components/view_character_card');
const { isActiveCharacter } = require('../../../features/rpg-tracker/utils/is_active_character');

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

        console.log(`🟡 /view-character invoked by ${userId} in guild ${guildId}`);

        try {
            const currentGameId = await getCurrentGame(userId, guildId);
            console.log('🎲 Current game ID for user:', currentGameId);

            if (!currentGameId) {
                return await interaction.reply({
                    content: '⚠️ No active game found. Use `/switch-game` or `/join-game` to select one.',
                    ephemeral: true,
                });
            }

            const allCharacters = await getCharactersByUser(userId, guildId);
            console.log(`📜 Found ${allCharacters.length} character(s) for user ${userId} in guild ${guildId}`);

            if (!allCharacters.length) {
                return await interaction.reply({
                    content: '⚠️ No character found. Use `/create-character` to start one.',
                    ephemeral: true,
                });
            }

            const activeCharacterId = await getCurrentCharacter(userId, guildId);
            console.log('👤 Active character ID:', activeCharacterId);

            const full = await getCharacterWithStats(activeCharacterId);
            if (!full) {
                return await interaction.reply({
                    content: '⚠️ Could not load your active character. Please try `/switch-character`.',
                    ephemeral: true,
                });
            }

            console.log('🔍 Fetched character with stats:', full.id);

            const { warning } = await validateGameAccess({ gameId: full.game_id, userId });

            const isSelf = await isActiveCharacter(userId, guildId, full.id);
            const view = buildCharacterCard(full, { viewerUserId: isSelf ? userId : null });

            console.log('🧱 buildCharacterCard output:', {
                hasEmbed: !!view.embeds?.length,
                hasComponents: !!view.components?.length,
                isEphemeral: view.ephemeral,
            });

            await interaction.reply({
                ...view,
                content: warning || view.content,
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
