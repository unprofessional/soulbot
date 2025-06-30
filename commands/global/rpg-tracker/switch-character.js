// commands/global/rpg-tracker/switch-character.js

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { getCharactersByUser } = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch-character')
        .setDescription('Select one of your characters to make active.'),

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
                    content: '⚠️ You don’t have an active game in this server. Use `/switch-game` or `/join-game` first.',
                    ephemeral: true,
                });
            }

            const allCharacters = await getCharactersByUser(userId, currentGameId);

            const eligibleCharacters = [];

            for (const character of allCharacters) {
                const { valid } = await validateGameAccess({
                    gameId: character.game_id,
                    userId,
                });

                if (valid) {
                    eligibleCharacters.push(character);
                }
            }

            if (!eligibleCharacters.length) {
                return await interaction.reply({
                    content: '⚠️ You have no characters in published or accessible games.',
                    ephemeral: true,
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('switchCharacterDropdown')
                .setPlaceholder('Choose your character')
                .addOptions(
                    eligibleCharacters.map(c => ({
                        label: `${c.name} (Lv ${c.level ?? 1} ${c.class || 'Unclassed'})`,
                        description: c.race || 'No race specified',
                        value: c.id,
                    }))
                );

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.reply({
                content: '🎭 Choose your active character:',
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('[COMMAND ERROR] /switch-character:', err);
            await interaction.reply({
                content: '❌ Failed to display character switcher. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
