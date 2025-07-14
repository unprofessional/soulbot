// features/rpg-tracker/button_handlers/fallback_buttons.js

const {
    getCharactersByUser,
    getCharacterWithStats,
} = require('../../../store/services/character.service');

const { isActiveCharacter } = require('../utils/is_active_character');
const { build: buildCharacterCard } = require('../components/view_character_card');

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

        const isSelf = await isActiveCharacter(userId, guildId, character.id);
        const view = buildCharacterCard(full, {
            viewerUserId: isSelf ? userId : null,
        });

        return await interaction.reply({
            ...view,
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
