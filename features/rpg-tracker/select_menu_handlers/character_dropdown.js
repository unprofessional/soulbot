// features/rpg-tracker/select_menu_handlers/character_dropdown.js

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const {
    setCurrentCharacter,
} = require('../../../store/services/player.service');

const {
    getCharacterWithStats,
} = require('../../../store/services/character.service');

const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('../embed_utils');

/**
 * Truncates a string to a maximum length, appending ellipsis if necessary.
 * Used to comply with Discord limits (e.g. 45 for titles/labels).
 * @param {string} str - The string to truncate.
 * @param {number} maxLength - Maximum allowed length.
 * @returns {string}
 */
function truncate(str, maxLength = 45) {
    return str.length > maxLength ? str.slice(0, maxLength - 3) + '...' : str;
}

/**
 * Handles character dropdown menus.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
    const { customId, user, values, guildId } = interaction;
    const selected = values?.[0];

    if (!selected) {
        return await interaction.reply({
            content: '⚠️ No selection made.',
            ephemeral: true,
        });
    }

    // === /create-character dropdown ===
    if (customId === 'createCharacterDropdown') {
        const [selectedField, rawLabel] = selected.split('|');
        const label = rawLabel || selectedField;

        const inputStyle = selectedField === 'core:bio'
            ? TextInputStyle.Paragraph
            : TextInputStyle.Short;

        const modal = new ModalBuilder()
            .setCustomId(`setCharacterField:${selectedField}|${label}`)
            .setTitle(truncate(`Enter value for ${label}`, 45))
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(selectedField)
                        .setLabel(truncate(`Value for ${label}`, 45))
                        .setStyle(inputStyle)
                        .setRequired(true)
                )
            );

        return await interaction.showModal(modal);
    }

    // === /switch-character dropdown ===
    if (customId === 'switchCharacterDropdown') {
        try {
            if (!guildId) {
                return await interaction.reply({
                    content: '⚠️ This action must be used in a server.',
                    ephemeral: true,
                });
            }

            await setCurrentCharacter(user.id, guildId, selected);
            const character = await getCharacterWithStats(selected);

            return await interaction.update({
                content: `✅ Switched to **${character.name}**!`,
                embeds: [buildCharacterEmbed(character)],
                components: [buildCharacterActionRow(character.id)],
            });
        } catch (err) {
            console.error('Error switching character:', err);
            return await interaction.reply({
                content: '❌ Failed to switch character.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
