// features/rpg-tracker/modal_handlers.js

const {
    createCharacter,
    getGame,
    updateHP,
    updateStat,
    updateCharacterMeta,
} = require('../../store/services/character.service');

module.exports = {
    /**
   * Handles modal submissions for character creation, HP/stat updates, and character info editing.
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
                const maxHp = parseInt(interaction.fields.getTextInputValue('hp'), 10);

                if (!name || !className || isNaN(maxHp)) {
                    return interaction.reply({
                        content: '⚠️ Invalid character data. Please check your inputs.',
                        ephemeral: true,
                    });
                }

                const guildId = interaction.guild?.id;
                const games = await getGame({ guildId });
                const game = Array.isArray(games) ? games[0] : games;

                if (!game) {
                    return interaction.reply({
                        content: '⚠️ No game found for this server. Ask your DM to create one first.',
                        ephemeral: true,
                    });
                }

                const character = await createCharacter({
                    userId: interaction.user.id,
                    gameId: game.id,
                    name,
                    className,
                    race,
                    level: 1,
                    hp: maxHp,
                    maxHp,
                    stats: {
                        str: 10,
                        dex: 10,
                        con: 10,
                        int: 10,
                        wis: 10,
                        cha: 10,
                    },
                });

                return interaction.reply({
                    content: `✅ Character **${character.name}** created in game **${game.name}**!`,
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

        // === Edit HP ===
        if (customId.startsWith('editHpModal:')) {
            const [, characterId] = customId.split(':');
            try {
                const newHp = parseInt(interaction.fields.getTextInputValue('currentHp'), 10);
                const newMax = parseInt(interaction.fields.getTextInputValue('maxHp'), 10);

                if (isNaN(newHp) || isNaN(newMax)) {
                    return interaction.reply({
                        content: '⚠️ Invalid HP values.',
                        ephemeral: true,
                    });
                }

                await updateHP(characterId, newHp, newMax);

                return interaction.reply({
                    content: `❤️ HP updated to **${newHp} / ${newMax}**`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Error in editHpModal:', err);
                return interaction.reply({
                    content: '❌ Failed to update HP.',
                    ephemeral: true,
                });
            }
        }

        // === Edit Stat ===
        if (customId.startsWith('editStatModal:')) {
            const [, characterId] = customId.split(':');
            try {
                const statName = interaction.fields.getTextInputValue('statName')?.toLowerCase();
                const statValue = parseInt(interaction.fields.getTextInputValue('statValue'), 10);

                const allowed = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
                if (!allowed.includes(statName)) {
                    return interaction.reply({
                        content: `⚠️ Invalid stat name. Use one of: ${allowed.join(', ')}.`,
                        ephemeral: true,
                    });
                }

                if (isNaN(statValue)) {
                    return interaction.reply({
                        content: '⚠️ Invalid stat value.',
                        ephemeral: true,
                    });
                }

                await updateStat(characterId, statName, statValue);

                return interaction.reply({
                    content: `🎲 Updated **${statName.toUpperCase()}** to **${statValue}**`,
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
                        content: '⚠️ Invalid name, class, or level input.',
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
    },
};
