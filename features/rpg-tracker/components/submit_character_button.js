// features/rpg-tracker/components/submit_character_button.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    isDraftComplete,
    getTempCharacterData,
    finalizeCharacterCreation,
} = require('../../../store/services/character_draft.service');

const {
    getCharacterWithStats,
} = require('../../../store/services/character.service');

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

const { isActiveCharacter } = require('../utils/is_active_character');

const id = 'submitNewCharacter';

function build(isDisabled = false) {
    const button = new ButtonBuilder()
        .setCustomId(id)
        .setLabel('✅ Submit Character')
        .setStyle(ButtonStyle.Success)
        .setDisabled(isDisabled);

    return new ActionRowBuilder().addComponents(button);
}

/**
 * Handles final character submission button.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { user } = interaction;
    const userId = user.id;

    try {
        const complete = await isDraftComplete(userId);
        if (!complete) {
            return await interaction.reply({
                content: '⚠️ Your character is missing required fields. Please finish filling them out.',
                ephemeral: true,
            });
        }

        const draft = await getTempCharacterData(userId);
        const character = await finalizeCharacterCreation(userId, draft);
        const fullCharacter = await getCharacterWithStats(character.id);

        const isSelf = await isActiveCharacter(interaction.user.id, interaction.guildId, character.id);

        return await interaction.update({
            content: `✅ Character **${character.name}** created successfully!`,
            embeds: [buildCharacterEmbed(fullCharacter)],
            components: [buildCharacterActionRow(character.id, {
                isSelf,
                visibility: character.visibility,
            })],
        });
    } catch (err) {
        console.error('[submit_character_button] Failed to submit character:', err);
        return await interaction.reply({
            content: '❌ Failed to submit character. Please try again.',
            ephemeral: true,
        });
    }
}

module.exports = {
    id,
    build,
    handle,
};
