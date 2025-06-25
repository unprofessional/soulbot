// commands/global/rpg-tracker/create-character.js

const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const { getOrCreatePlayer } = require('../../../store/services/player.service');
const { getGame, getStatTemplates } = require('../../../store/services/game.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-character')
        .setDescription('Create a character for your current game.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        if (!guildId) {
            return interaction.reply({
                content: '⚠️ You must use this command in a server.',
                ephemeral: true,
            });
        }

        const player = await getOrCreatePlayer(userId);
        const gameId = player?.current_game_id;

        if (!gameId) {
            return interaction.reply({
                content: '⚠️ You haven’t joined a game yet. Use `/join-game` to select one.',
                ephemeral: true,
            });
        }

        const game = await getGame({ id: gameId });

        if (!game) {
            return interaction.reply({
                content: '⚠️ Your currently joined game no longer exists.',
                ephemeral: true,
            });
        }

        if (!game.is_public && game.created_by !== userId) {
            return interaction.reply({
                content: '⚠️ This game is no longer public. You must ask the GM to republish it or invite you.',
                ephemeral: true,
            });
        }

        const statTemplates = await getStatTemplates(gameId);

        if (!statTemplates.length) {
            return interaction.reply({
                content: '⚠️ This game has no stat fields defined yet. Ask the GM to set them up.',
                ephemeral: true,
            });
        }

        const fields = statTemplates.slice(0, 5);

        const modal = new ModalBuilder()
            .setCustomId(`createCharacterModal:${gameId}`)
            .setTitle('Create New Character');

        for (const field of fields) {
            const input = new TextInputBuilder()
                .setCustomId(field.id)
                .setLabel(field.label.slice(0, 45))
                .setRequired(Boolean(field.is_required))
                .setStyle(field.field_type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short);

            if (field.default_value) {
                input.setValue(field.default_value.slice(0, 4000));
            }

            modal.addComponents(new ActionRowBuilder().addComponents(input));
        }

        return interaction.showModal(modal);
    },
};
