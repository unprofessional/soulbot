// features/rpg-tracker/modal_handlers.js

const {
    createCharacter,
    updateStat,
    updateCharacterMeta,
} = require('../../store/services/character.service');
const {
    createItem,
} = require('../../store/services/inventory.service');
const {
    getOrCreatePlayer,
} = require('../../store/services/player.service');
const {
    addStatTemplates,
} = require('../../store/services/game.service');

module.exports = {
    /**
     * Handles modal submissions for character creation, stat updates, metadata updates, and inventory.
     * @param {import('discord.js').ModalSubmitInteraction} interaction
     */
    async handleModal(interaction) {
        const { customId } = interaction;

        // === GM Create Default Game Stats ===
        if (customId.startsWith('createStatTemplate:')) {
            const [, gameId] = customId.split(':');
            try {
                const label = interaction.fields.getTextInputValue('label')?.trim();
                const name = interaction.fields.getTextInputValue('name')?.trim().toLowerCase();
                const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim() || null;
                const fieldType = interaction.fields.getTextInputValue('field_type')?.trim().toLowerCase();
                const sortOrderRaw = interaction.fields.getTextInputValue('sort_order')?.trim();

                // === Validation ===
                if (!label || !name || !['short', 'paragraph'].includes(fieldType)) {
                    return interaction.reply({
                        content: '⚠️ Please provide a valid label, name, and field type ("short" or "paragraph").',
                        ephemeral: true,
                    });
                }

                if (!/^[a-zA-Z0-9_]{1,20}$/.test(name)) {
                    return interaction.reply({
                        content: '⚠️ Stat name must be alphanumeric with optional underscores (max 20 chars).',
                        ephemeral: true,
                    });
                }

                const sortOrder = isNaN(parseInt(sortOrderRaw)) ? 0 : parseInt(sortOrderRaw, 10);

                await addStatTemplates(gameId, [
                    {
                        name,
                        label,
                        field_type: fieldType,
                        default_value: defaultValue,
                        is_required: true,
                        sort_order: sortOrder,
                    },
                ]);

                return interaction.reply({
                    content: `✅ Added stat field **${label}** \`(${name})\` to this game's required character template.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error in createStatTemplate modal:', err);
                return interaction.reply({
                    content: '❌ Failed to add stat template. Please try again.',
                    ephemeral: true,
                });
            }
        }

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

                const item = await createItem(characterId, {
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
