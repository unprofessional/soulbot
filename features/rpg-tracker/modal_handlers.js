const {
    createCharacter,
    updateStat,
    updateCharacterMeta,
} = require('../../store/services/character.service');
const {
    createInventoryItem,
} = require('../../store/services/inventory.service');
const {
    getOrCreatePlayer,
} = require('../../store/services/player.service');

module.exports = {
    /**
     * Handles modal submissions for character creation, stat updates, metadata updates, and inventory.
     * @param {import('discord.js').ModalSubmitInteraction} interaction
     */
    async handleModal(interaction) {
        const { customId } = interaction;

        // === Create Character ===
        if (customId === 'createCharacterModal') {
            try {
                const name = interaction.fields.getTextInputValue('name');
                const className = interaction.fields.getTextInputValue('class');
                const race = interaction.fields.getTextInputValue('race');
                const rawMaxHp = interaction.fields.getTextInputValue('hp');

                const maxHp = parseInt(rawMaxHp, 10);
                if (!name || !className || isNaN(maxHp)) {
                    return interaction.reply({
                        content: '⚠️ Invalid character input. Make sure name, class, and HP are valid.',
                        ephemeral: true,
                    });
                }

                if (!interaction.guildId) {
                    return interaction.reply({
                        content: '⚠️ You must use this command in a server (not a DM).',
                        ephemeral: true,
                    });
                }

                // 🔄 Get player record and resolve current game
                const player = await getOrCreatePlayer(interaction.user.id);
                const gameId = player?.current_game_id;

                if (!gameId) {
                    return interaction.reply({
                        content: '⚠️ You haven’t joined a game yet. Use `/join-game` to select one.',
                        ephemeral: true,
                    });
                }

                const character = await createCharacter({
                    userId: interaction.user.id,
                    gameId,
                    name,
                    clazz: className,
                    race,
                    level: 1,
                    stats: { hp: maxHp },
                });

                return interaction.reply({
                    content: `✅ Character **${character.name}** created and joined your active game!`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error in createCharacterModal:', err);
                return interaction.reply({
                    content: '❌ Failed to create character. Please try again later.',
                    ephemeral: true,
                });
            }
        }

        // === Edit Stat ===
        if (customId.startsWith('editStatModal:')) {
            const [, characterId] = customId.split(':');
            try {
                const statName = interaction.fields.getTextInputValue('statName')?.toLowerCase().trim();
                const statValue = parseInt(interaction.fields.getTextInputValue('statValue'), 10);

                if (!/^[a-zA-Z0-9_]{1,20}$/.test(statName)) {
                    return interaction.reply({
                        content: '⚠️ Invalid stat name. Use short alphanumeric identifiers (e.g., `hp`, `mana`).',
                        ephemeral: true,
                    });
                }

                if (isNaN(statValue)) {
                    return interaction.reply({
                        content: '⚠️ Invalid stat value. Must be a number.',
                        ephemeral: true,
                    });
                }

                await updateStat(characterId, statName, statValue);

                return interaction.reply({
                    content: `🎲 Updated **${statName.toUpperCase()}** to **${statValue}**.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error in editStatModal:', err);
                return interaction.reply({
                    content: '❌ Failed to update stat.',
                    ephemeral: true,
                });
            }
        }

        // === Edit Character Metadata ===
        if (customId.startsWith('editCharacterModal:')) {
            const [, characterId] = customId.split(':');
            try {
                const name = interaction.fields.getTextInputValue('name');
                const className = interaction.fields.getTextInputValue('class');
                const race = interaction.fields.getTextInputValue('race');
                const level = parseInt(interaction.fields.getTextInputValue('level'), 10);
                const notes = interaction.fields.getTextInputValue('notes');

                if (!name || !className || isNaN(level)) {
                    return interaction.reply({
                        content: '⚠️ Invalid input. Please provide valid name, class, and level.',
                        ephemeral: true,
                    });
                }

                await updateCharacterMeta(characterId, {
                    name,
                    class: className,
                    race,
                    level,
                    notes,
                });

                return interaction.reply({
                    content: `📝 Character **${name}** updated successfully.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error in editCharacterModal:', err);
                return interaction.reply({
                    content: '❌ Failed to update character info.',
                    ephemeral: true,
                });
            }
        }

        // === Add Inventory Item ===
        if (customId.startsWith('addInventoryModal:')) {
            const [, characterId] = customId.split(':');
            try {
                const name = interaction.fields.getTextInputValue('name')?.trim();
                const type = interaction.fields.getTextInputValue('type')?.trim() || null;
                const description = interaction.fields.getTextInputValue('description')?.trim() || null;

                if (!name || name.length > 100) {
                    return interaction.reply({
                        content: '⚠️ Invalid item name.',
                        ephemeral: true,
                    });
                }

                const item = await createInventoryItem({
                    characterId,
                    name,
                    type,
                    description,
                    equipped: false,
                });

                return interaction.reply({
                    content: `✅ Added **${item.name}** to inventory.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error in addInventoryModal:', err);
                return interaction.reply({
                    content: '❌ Failed to add inventory item.',
                    ephemeral: true,
                });
            }
        }
    },
};
