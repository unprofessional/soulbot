// commands/global/rpg-tracker/edit-character.js

const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getCharactersByUser } = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-character')
        .setDescription('Edit your current character’s core info'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        if (!guildId) {
            return interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        try {
            const currentGameId = await getCurrentGame(userId, guildId);
            if (!currentGameId) {
                return interaction.reply({
                    content: '⚠️ No active game found. Use `/switch-game` first.',
                    ephemeral: true,
                });
            }

            const characters = await getCharactersByUser(userId, currentGameId);
            const character = characters[0];

            if (!character) {
                return interaction.reply({
                    content: '⚠️ No character found. Use `/create-character` first.',
                    ephemeral: true,
                });
            }

            const { valid, warning } = await validateGameAccess({
                gameId: character.game_id,
                userId,
            });

            if (!valid) {
                return interaction.reply({
                    content: warning || '⚠️ You no longer have access to this game.',
                    ephemeral: true,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`editCharacterModal:${character.id}`)
                .setTitle('Edit Character Info')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setLabel('Character Name')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setValue(character.name || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('class')
                            .setLabel('Class or Role')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setValue(character.class || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('race')
                            .setLabel('Race or Origin')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setValue(character.race || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('level')
                            .setLabel('Level')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setValue(String(character.level || 1))
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('notes')
                            .setLabel('Notes')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                            .setValue(character.notes || '')
                    )
                );

            await interaction.showModal(modal);
        } catch (err) {
            console.error('[COMMAND ERROR] /edit-character:', err);
            await interaction.reply({
                content: '❌ Failed to retrieve your character.',
                ephemeral: true,
            });
        }
    },
};
