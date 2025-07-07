// features/rpg-tracker/select_menu_handlers/public_character_select.js

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

const {
    getCharacterWithStats,
} = require('../../../store/services/character.service');
const { isActiveCharacter } = require('../utils/is_active_character');

/**
 * Handles selection of a public character from the dropdown.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    try {
        const [customId] = interaction.customId.split(':');
        if (customId !== 'selectPublicCharacter') return;

        const characterId = interaction.values?.[0];
        if (!characterId) {
            return await interaction.reply({
                content: '⚠️ No character selected.',
                ephemeral: true,
            });
        }

        const character = await getCharacterWithStats(characterId);
        if (!character) {
            return await interaction.reply({
                content: '❌ That character no longer exists.',
                ephemeral: true,
            });
        }

        const isSelf = await isActiveCharacter(interaction.user.id, interaction.guildId, character.id);

        const embed = buildCharacterEmbed(character, { mode: 'view' });
        const actionRow = buildCharacterActionRow(character.id, {
            isSelf,
            visibility: character.visibility,
        });


        await interaction.reply({
            embeds: [embed],
            components: actionRow ? [actionRow] : [],
            ephemeral: true,
        });

    } catch (err) {
        console.error('[SELECT MENU ERROR] public_character_select:', err);
        await interaction.reply({
            content: '❌ Failed to display character details.',
            ephemeral: true,
        });
    }
}

module.exports = { handle };
