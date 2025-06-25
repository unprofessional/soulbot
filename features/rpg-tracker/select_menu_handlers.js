const { setCurrentCharacter } = require('../../store/services/user-profile.service');
const { getCharacterWithStats } = require('../../store/services/character.service');
const { buildCharacterEmbed, buildCharacterActionRow } = require('./embed_utils');

module.exports = {
    /**
     * Handles character selection from dropdown.
     * @param {import('discord.js').StringSelectMenuInteraction} interaction
     */
    async handleSelectMenu(interaction) {
        const { customId, user } = interaction;

        // === /switch-character dropdown ===
        if (customId === 'switchCharacterDropdown') {
            const selectedId = interaction.values?.[0];
            if (!selectedId) {
                return await interaction.reply({
                    content: '⚠️ No character selected.',
                    ephemeral: true,
                });
            }

            try {
                await setCurrentCharacter(user.id, selectedId);

                const character = await getCharacterWithStats(selectedId);

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
    },
};
