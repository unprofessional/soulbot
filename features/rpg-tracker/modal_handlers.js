// features/rpg-tracker/modal_handlers.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

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
    getStatTemplates,
    updateGame,
} = require('../../store/services/game.service');
const { getRemainingRequiredFields, upsertTempCharacterField } = require('../../store/services/character_draft.service');

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
                const defaultValue = interaction.fields.getTextInputValue('default_value')?.trim() || null;
                const fieldType = interaction.fields.getTextInputValue('field_type')?.trim().toLowerCase();
                const sortOrderRaw = interaction.fields.getTextInputValue('sort_order')?.trim();
                const sortOrder = isNaN(parseInt(sortOrderRaw)) ? 0 : parseInt(sortOrderRaw, 10);

                if (!label || !['short', 'paragraph'].includes(fieldType)) {
                    return interaction.reply({
                        content: '⚠️ Please provide a valid label and field type ("short" or "paragraph").',
                        ephemeral: true,
                    });
                }

                await addStatTemplates(gameId, [
                    {
                        label,
                        field_type: fieldType,
                        default_value: defaultValue,
                        is_required: true,
                        sort_order: sortOrder,
                    },
                ]);

                // Fetch current stat template for preview
                const allFields = await getStatTemplates(gameId);

                const fieldDescriptions = allFields.map((f) => {
                    const icon = f.field_type === 'paragraph' ? '📝' : '🔹';
                    const defaultVal = f.default_value ? ` _(default: ${f.default_value})_` : '';
                    return `${icon} **${f.label}**${defaultVal}`;
                });

                const embed = new EmbedBuilder()
                    .setTitle('📋 Current Stat Template')
                    .setDescription(fieldDescriptions.length ? fieldDescriptions.join('\n') : '*No fields yet.*')
                    .setColor(0x00b0f4);

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`defineStats:${gameId}`)
                        .setLabel('➕ Add Another Stat')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`finishStatSetup:${gameId}`)
                        .setLabel('✅ Done')
                        .setStyle(ButtonStyle.Success)
                );

                return interaction.reply({
                    content: `✅ Added stat field **${label}**.`,
                    embeds: [embed],
                    components: [actionRow],
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

        // === GM UPDATE Game Name and Desc ===
        if (customId.startsWith('editGameModal:')) {
            const [, gameId] = customId.split(':');

            try {
                const name = interaction.fields.getTextInputValue('name')?.trim();
                const description = interaction.fields.getTextInputValue('description')?.trim();

                if (!name || name.length > 100) {
                    return interaction.reply({
                        content: '⚠️ Invalid game name. Please keep it under 100 characters.',
                        ephemeral: true,
                    });
                }

                const game = await updateGame(gameId, { name, description });

                const defineStatsBtn = new ButtonBuilder()
                    .setCustomId(`defineStats:${game.id}`)
                    .setLabel('Define Required Stats')
                    .setStyle(ButtonStyle.Primary);

                const publishBtn = new ButtonBuilder()
                    .setCustomId(`publishGame:${game.id}`)
                    .setLabel('📣 Publish Game')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(
                    defineStatsBtn,
                    publishBtn
                );

                return interaction.reply({
                    content: `🛠️ Game updated to **${game.name}**.`,
                    components: [row],
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error in editGameModal:', err);
                return interaction.reply({
                    content: '❌ Failed to update game.',
                    ephemeral: true,
                });
            }
        }

        // === Create Character ===
        if (customId.startsWith('createCharacterModal:')) {
            const [, gameId] = customId.split(':');

            try {
                if (!interaction.guildId) {
                    return interaction.reply({
                        content: '⚠️ You must use this command in a server (not a DM).',
                        ephemeral: true,
                    });
                }

                const player = await getOrCreatePlayer(interaction.user.id);
                if (!player?.current_game_id || player.current_game_id !== gameId) {
                    return interaction.reply({
                        content: '⚠️ You must join the game before creating a character.',
                        ephemeral: true,
                    });
                }

                const statTemplates = await getStatTemplates(gameId);
                if (!statTemplates.length) {
                    return interaction.reply({
                        content: '⚠️ This game has no stat fields defined. Ask the GM to add some first.',
                        ephemeral: true,
                    });
                }

                // Initialize metadata and stats
                let name = 'Unnamed';
                let clazz = '';
                let race = '';
                let level = 1;
                const statFields = {};

                for (const template of statTemplates) {
                    const value = interaction.fields.getTextInputValue(template.id)?.trim() || '';

                    // Pull metadata from label
                    const lowerLabel = template.label.toLowerCase();
                    if (lowerLabel === 'name') {
                        name = value || name;
                    } else if (lowerLabel === 'class' || lowerLabel === 'role') {
                        clazz = value || clazz;
                    } else if (lowerLabel === 'race' || lowerLabel === 'origin') {
                        race = value || race;
                    } else if (lowerLabel === 'level') {
                        const parsed = parseInt(value, 10);
                        if (!isNaN(parsed)) level = parsed;
                    }

                    // Always save by template.id
                    statFields[template.id] = value;
                }

                if (!name || !clazz) {
                    return interaction.reply({
                        content: '⚠️ Name and class are required.',
                        ephemeral: true,
                    });
                }

                const character = await createCharacter({
                    userId: interaction.user.id,
                    gameId,
                    name,
                    clazz,
                    race,
                    level,
                    stats: statFields, // { [templateId]: value }
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

        // === Set Temporary Character Field from Modal ===
        if (customId.startsWith('setCharacterField:')) {
            const fieldKey = customId.split(':').slice(1).join(':'); // ✅ grabs "core:name"
            const value = interaction.fields.getTextInputValue(fieldKey)?.trim();

            if (!fieldKey || !value) {
                return interaction.reply({
                    content: '⚠️ Missing field key or value.',
                    ephemeral: true,
                });
            }

            await upsertTempCharacterField(interaction.user.id, fieldKey, value);

            const remaining = await getRemainingRequiredFields(interaction.user.id);

            if (remaining.length === 0) {
                return await interaction.reply({
                    content: '✅ All required fields are filled! Submit when ready:',
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('submitNewCharacter')
                                .setLabel('Submit Character')
                                .setStyle(ButtonStyle.Success)
                        )
                    ],
                    ephemeral: true,
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('createCharacterDropdown')
                .setPlaceholder('Choose next field to define')
                .addOptions(
                    remaining.map(field => ({
                        label: field.label,
                        value: field.name,
                    }))
                );

            return interaction.reply({
                content: `✅ Saved **${fieldKey}**. Choose next field:`,
                components: [new ActionRowBuilder().addComponents(menu)],
                ephemeral: true,
            });
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
