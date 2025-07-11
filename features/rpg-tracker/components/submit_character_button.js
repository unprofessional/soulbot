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
    setCurrentCharacter,
} = require('../../../store/services/player.service');

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
    const { user, guildId } = interaction;
    const userId = user.id;

    try {
        const complete = await isDraftComplete(userId);
        console.log(`[submit_character_button] Draft completeness for user ${userId}: ${complete}`);

        if (!complete) {
            return await interaction.reply({
                content: '⚠️ Your character is missing required fields. Please finish filling them out.',
                ephemeral: true,
            });
        }

        const draft = await getTempCharacterData(userId);
        console.log(`[submit_character_button] Draft data for user ${userId}:`, draft);

        const character = await finalizeCharacterCreation(userId, draft);
        console.log(`[submit_character_button] Finalized character: ${character.name} (${character.id})`);

        // 🔧 Set the newly created character as active
        await setCurrentCharacter(userId, guildId, character.id);
        console.log(`[submit_character_button] Set ${character.name} (${character.id}) as active character for ${userId} in ${guildId}`);

        const fullCharacter = await getCharacterWithStats(character.id);

        const isSelf = await isActiveCharacter(userId, guildId, character.id);
        console.log(`[submit_character_button] isActiveCharacter(${userId}, ${guildId}, ${character.id}) → ${isSelf}`);

        const response = {
            content: `✅ Character **${character.name}** created successfully!`,
            embeds: [buildCharacterEmbed(fullCharacter)],
        };

        const actionRow = isSelf
            ? buildCharacterActionRow(character.id, {
                isSelf,
                visibility: character.visibility,
            })
            : null;

        if (actionRow) {
            response.components = [actionRow];
        }

        return await interaction.update(response);
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
