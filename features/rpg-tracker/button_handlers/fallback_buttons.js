// features/rpg-tracker/button_handlers/fallback_buttons.js

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

const {
    getCharactersByUser,
    getCharacterWithStats,
} = require('../../../store/services/character.service');

/**
 * Fallback for unknown buttons or default character view.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    return await interaction.reply({
        content: '❌ Unrecognized button interaction.',
        ephemeral: true,
    });
}

/**
 * Called from command-based character viewer fallback.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        return await interaction.reply({
            content: '⚠️ This command must be used in a server.',
            ephemeral: true,
        });
    }

    try {
        const allCharacters = await getCharactersByUser(userId, guildId);
        const character = allCharacters.find(c => c.guild_id === guildId) || allCharacters[0];

        if (!character) {
            return await interaction.reply({
                content: '⚠️ No character found. Use `/create-character` to start one.',
                ephemeral: true,
            });
        }

        const full = await getCharacterWithStats(character.id);

        return await interaction.reply({
            embeds: [buildCharacterEmbed(full)],
            components: [buildCharacterActionRow(character.id, character.visibility)],
            ephemeral: true,
        });
    } catch (err) {
        console.error('[BUTTON HANDLER ERROR]:', err);
        return await interaction.reply({
            content: '❌ Failed to load character view.',
            ephemeral: true,
        });
    }
}

module.exports = { handle, execute };
