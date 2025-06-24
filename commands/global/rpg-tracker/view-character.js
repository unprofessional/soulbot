// commands/global/rpg-tracker/view-character.js

const { SlashCommandBuilder } = require('discord.js');
const {
    getCharactersByUser,
    getCharacterWithStats,
} = require('../../../store/services/character.service');
const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../../../features/rpg-tracker/embed_utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-character')
        .setDescription("View your character's stats for this game's campaign."),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        try {
            const allCharacters = await getCharactersByUser(userId);
            const character =
        allCharacters.find(
            (c) => c.game_id && c.game_id.length && c.guild_id === guildId
        ) || allCharacters[0];

            if (!character) {
                return await interaction.reply({
                    content: '⚠️ No character found. Use `/create-character` to start one.',
                    ephemeral: true,
                });
            }

            const full = await getCharacterWithStats(character.id);
            const embed = buildCharacterEmbed(full);
            const row = buildCharacterActionRow(character.id);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in /view-character:', err);
            await interaction.reply({
                content: '❌ Failed to retrieve character. Try again later.',
                ephemeral: true,
            });
        }
    },
};
