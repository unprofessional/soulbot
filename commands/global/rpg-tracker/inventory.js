// commands/global/rpg-tracker/inventory.js

const { SlashCommandBuilder } = require('discord.js');
const { getCurrentCharacter } = require('../../../store/services/player.service');
const { getCharacterWithInventory } = require('../../../store/services/inventory.service');
const { buildInventoryEmbed, buildInventoryActionRow } = require('../../../features/rpg-tracker/embed_utils');
const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription("View your character's inventory and manage items."),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const characterId = await getCurrentCharacter(userId);
            if (!characterId) {
                return await interaction.reply({
                    content: '⚠️ No active character selected. Use `/switch-character` first.',
                    ephemeral: true,
                });
            }

            const character = await getCharacterWithInventory(characterId);

            const { valid, warning } = await validateGameAccess({
                gameId: character.game_id,
                userId,
            });

            if (!valid) {
                return await interaction.reply({
                    content: warning || '⚠️ You no longer have access to this game.',
                    ephemeral: true,
                });
            }

            const embed = buildInventoryEmbed(character);
            const row = buildInventoryActionRow(character.id);

            return await interaction.reply({
                content: warning || undefined,
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in /inventory:', err);
            return await interaction.reply({
                content: '❌ Failed to retrieve inventory.',
                ephemeral: true,
            });
        }
    },
};
