// features/rpg-tracker/components/public_character_selector.js

const {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
} = require('discord.js');

const { getCharacterWithStats } = require('../../../store/services/character.service');
const { isActiveCharacter } = require('../utils/is_active_character');
const { build: buildCharacterCard } = require('./view_character_card');

const id = 'selectPublicCharacter';

/**
 * Builds the character select dropdown for public characters.
 */
function build(page, characters) {
    const options = characters.map(char =>
        new StringSelectMenuOptionBuilder()
            .setLabel(char.label)
            .setDescription(char.description)
            .setValue(char.id)
    );

    const select = new StringSelectMenuBuilder()
        .setCustomId(`${id}:${page}`)
        .setPlaceholder('Select a character to view...')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

/**
 * Handles selection of a public character from the dropdown.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    try {
        const [customId] = interaction.customId.split(':');
        if (customId !== id) return;

        const characterId = interaction.values?.[0];
        if (!characterId) {
            return await interaction.reply({
                content: '⚠️ No character selected.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const character = await getCharacterWithStats(characterId);
        if (!character) {
            return await interaction.editReply({
                content: '❌ That character no longer exists.',
            });
        }

        const isSelf = await isActiveCharacter(interaction.user.id, interaction.guildId, character.id);
        const view = buildCharacterCard(character, isSelf);

        await interaction.editReply(view);

    } catch (err) {
        console.error('[SELECT MENU ERROR] public_character_selector:', err);
        if (!interaction.replied) {
            await interaction.reply({
                content: '❌ Failed to display character details.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { id, build, handle };
