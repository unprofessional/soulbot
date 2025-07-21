// commands/global/rpg-tracker/inventory.js

const { SlashCommandBuilder } = require('discord.js');
const { getCurrentCharacter } = require('../../../store/services/player.service');
const { getCharacterWithInventory } = require('../../../store/services/inventory.service');
const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');
const { build: buildInventoryCard } = require('../../../features/rpg-tracker/components/view_inventory_card');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription("View your character's inventory and manage items."),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        try {
            const characterId = await getCurrentCharacter(userId, guildId);
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

            const { embeds, components } = buildInventoryCard(character);

            return await interaction.reply({
                content: warning || undefined,
                embeds,
                components,
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
