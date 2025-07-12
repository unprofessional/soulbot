// features/rpg-tracker/components/confirm_delete_character_button.js

// features/rpg-tracker/components/confirm_delete_character_button.js

const {
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getCharacterWithStats,
    deleteCharacter,
} = require('../../../store/services/character.service');

const id = 'confirmDeleteCharacter';

function build(characterId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${characterId}`)
        .setLabel('✅ Confirm Delete')
        .setStyle(ButtonStyle.Danger);
}

async function handle(interaction) {
    const { customId, user } = interaction;
    const [, characterId] = customId.split(':');

    try {
        // 🔐 Final ownership safety check
        const character = await getCharacterWithStats(characterId);
        if (!character || character.user_id !== user.id) {
            return await interaction.reply({
                content: '❌ You do not have permission to delete this character.',
                ephemeral: true,
            });
        }

        console.log(`🚨 Deleting character ${characterId} on user confirm`);
        await deleteCharacter(characterId);

        return await interaction.update({
            content: '🗑️ Character successfully deleted.',
            embeds: [],
            components: [],
        });
    } catch (err) {
        console.error('❌ Failed to delete character:', err);
        return await interaction.reply({
            content: '❌ Something went wrong while deleting the character.',
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
