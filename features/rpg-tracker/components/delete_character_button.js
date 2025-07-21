// features/rpg-tracker/components/delete_character_button.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { build: buildConfirmDeleteButton } = require('./confirm_delete_character_button');

const id = 'deleteCharacter';

function build(characterId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${characterId}`)
        .setLabel('🗑️ Delete Character')
        .setStyle(ButtonStyle.Danger);
}

async function handle(interaction) {
    const { customId, user } = interaction;
    const [, characterId] = customId.split(':');

    try {
        const character = await getCharacterWithStats(characterId);

        // 🔐 Ownership check here before even offering confirmation
        if (!character || character.user_id !== user.id) {
            return await interaction.reply({
                content: '❌ You do not have permission to delete this character.',
                ephemeral: true,
            });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
            buildConfirmDeleteButton(characterId),
            new ButtonBuilder()
                .setCustomId(`goBackToCharacter:${characterId}`)
                .setLabel('↩️ Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({
            content: `🗑️ Are you sure you want to permanently delete **${character.name}**?`,
            embeds: [],
            components: [confirmRow],
        });
    } catch (err) {
        console.error('Error preparing delete character confirmation:', err);
        return await interaction.reply({
            content: '❌ Something went wrong while preparing to delete this character.',
            ephemeral: true,
        });
    }
}

module.exports = { id, build, handle };
