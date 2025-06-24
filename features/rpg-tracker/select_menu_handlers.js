// features/rpg-tracker/select_menu_handlers.js

const { setActiveCharacter } = require('../../store/services/user-profile.service');
const { getCharacterWithStats } = require('../../store/services/character.service');
const { buildCharacterEmbed, buildCharacterActionRow } = require('./embed_utils');

module.exports = {
    /**
     * Handles character selection from dropdown.
     * @param {import('discord.js').StringSelectMenuInteraction} interaction
     */
    async handleSelectMenu(interaction) {
        const { customId, user, guild } = interaction;

        // === Handle /switch-character dropdown ===
        if (customId === 'switchCharacterDropdown') {
            const selectedId = interaction.values[0]; // only 1 selection allowed
            try {
                await setActiveCharacter({
                    userId: user.id,
                    guildId: guild.id,
                    characterId: selectedId,
                });

                const character = await getCharacterWithStats(selectedId);

                return await interaction.update({
                    content: `✅ Switched to **${character.name}**!`,
                    embeds: [buildCharacterEmbed(character)],
                    components: [buildCharacterActionRow(character)],
                });
            } catch (err) {
                console.error('Error switching character:', err);
                return await interaction.reply({
                    content: '❌ Failed to switch character.',
                    ephemeral: true,
                });
            }
        }
    },
};
