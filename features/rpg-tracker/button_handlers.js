const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getCharactersByUser, getCharacterWithStats } = require('../../store/services/character.service');
const { deleteInventoryByCharacter } = require('../../store/services/inventory.service');
const {
    buildCharacterEmbed,
    buildCharacterActionRow,
} = require('./embed_utils');

module.exports = {
    /**
     * Handles direct button interaction events.
     * @param {import('discord.js').ButtonInteraction} interaction
     */
    async handleButton(interaction) {
        const { customId } = interaction;

        // === Edit Stat Modal ===
        if (customId.startsWith('edit_stat:')) {
            const characterId = customId.split(':')[1];

            const modal = new ModalBuilder()
                .setCustomId(`editStatModal:${characterId}`)
                .setTitle('Edit Character Stat')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('statName')
                            .setLabel('Stat Name (e.g., hp, vigor, ranged)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('statValue')
                            .setLabel('New Stat Value (integer)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === Add Inventory Modal ===
        if (customId.startsWith('add_inventory_item:')) {
            const [, characterId] = customId.split(':');

            const modal = new ModalBuilder()
                .setCustomId(`addInventoryModal:${characterId}`)
                .setTitle('Add Inventory Item')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel('Item Name')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('type')
                            .setLabel('Item Type (optional)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('description')
                            .setLabel('Description (optional)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === Trigger inventory clear confirmation ===
        if (customId.startsWith('clear_inventory:')) {
            const [, characterId] = customId.split(':');

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_clear_inventory:${characterId}`)
                    .setLabel('Yes, Delete All Items')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_clear_inventory')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            return await interaction.reply({
                content: '⚠️ Are you sure you want to delete all inventory items for this character?',
                components: [confirmRow],
                ephemeral: true,
            });
        }

        // === Confirm inventory deletion ===
        if (customId.startsWith('confirm_clear_inventory:')) {
            const [, characterId] = customId.split(':');

            try {
                await deleteInventoryByCharacter(characterId);
                return await interaction.update({
                    content: '🗑️ Inventory cleared.',
                    components: [],
                });
            } catch (err) {
                console.error('Error clearing inventory:', err);
                return await interaction.update({
                    content: '❌ Failed to clear inventory.',
                    components: [],
                });
            }
        }

        // === Cancel inventory deletion ===
        if (customId === 'cancel_clear_inventory') {
            return await interaction.update({
                content: '❎ Inventory deletion cancelled.',
                components: [],
            });
        }

        // === Unknown / fallback ===
        return await interaction.reply({
            content: '❌ Unrecognized button interaction.',
            ephemeral: true,
        });
    },

    /**
     * (Optional) Compatibility: shows character view if this module is still being invoked as a command.
     */
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
            const allCharacters = await getCharactersByUser(userId, guildId);
            const character = allCharacters.find(c => c.guild_id === guildId) || allCharacters[0];

            if (!character) {
                return await interaction.reply({
                    content: '⚠️ No character found. Use `/create-character` to start one.',
                    ephemeral: true,
                });
            }

            const full = await getCharacterWithStats(character.id);
            const embed = buildCharacterEmbed(full);
            const row = buildCharacterActionRow(character.id);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('[BUTTON HANDLER ERROR]:', err);
            await interaction.reply({
                content: '❌ Failed to load character view.',
                ephemeral: true,
            });
        }
    },
};
