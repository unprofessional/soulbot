// features/rpg-tracker/modal_handlers/character_creation_modals.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

const {
    getOrCreatePlayer,
} = require('../../store/services/player.service');
const {
    getStatTemplates,
    createCharacter,
} = require('../../store/services/character.service');
const {
    getRemainingRequiredFields,
    upsertTempCharacterField,
    getTempCharacterData,
} = require('../../store/services/character_draft.service');

/**
 * Handles modals related to character creation.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === Full Character Creation ===
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

            // Collect fields
            let name = 'Unnamed';
            let clazz = '';
            let race = '';
            let level = 1;
            const statFields = {};

            for (const template of statTemplates) {
                const value = interaction.fields.getTextInputValue(template.id)?.trim() || '';

                // Infer metadata from labels
                const lowerLabel = template.label.toLowerCase();
                if (lowerLabel === 'name') name = value || name;
                else if (lowerLabel === 'class' || lowerLabel === 'role') clazz = value || clazz;
                else if (lowerLabel === 'race' || lowerLabel === 'origin') race = value || race;
                else if (lowerLabel === 'level') {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed)) level = parsed;
                }

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
                stats: statFields,
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

    // === Set a Single Character Field from Modal ===
    if (customId.startsWith('setCharacterField:')) {
        const fieldKey = customId.split(':').slice(1).join(':');
        const value = interaction.fields.getTextInputValue(fieldKey)?.trim();

        if (!fieldKey || !value) {
            return interaction.reply({
                content: '⚠️ Missing field key or value.',
                ephemeral: true,
            });
        }

        const existingDraft = await getTempCharacterData(interaction.user.id);
        const gameId = existingDraft?.game_id || null;

        await upsertTempCharacterField(interaction.user.id, fieldKey, value, gameId);

        const remaining = await getRemainingRequiredFields(interaction.user.id);

        if (remaining.length === 0) {
            const replyData = {
                content: '✅ All required fields are filled! Submit when ready:',
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('submitNewCharacter')
                            .setLabel('Submit Character')
                            .setStyle(ButtonStyle.Success)
                    ),
                ],
                ephemeral: true,
            };

            return interaction.replied || interaction.deferred
                ? interaction.editReply(replyData)
                : interaction.reply(replyData);
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

        const replyData = {
            content: `✅ Saved **${fieldKey}**. Choose next field:`,
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true,
        };

        return interaction.replied || interaction.deferred
            ? interaction.editReply(replyData)
            : interaction.reply(replyData);
    }
}

module.exports = { handle };
