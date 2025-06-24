// commands/global/rpg-tracker/create-character.js

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-character')
        .setDescription('Create a DnD character for your current game.'),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('createCharacterModal')
            .setTitle('Create New Character')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel('Character Name')
                        .setRequired(true)
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('class')
                        .setLabel('Class')
                        .setRequired(true)
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('race')
                        .setLabel('Race')
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('hp')
                        .setLabel('Max HP')
                        .setRequired(true)
                        .setStyle(TextInputStyle.Short)
                )
            );

        await interaction.showModal(modal);
    },
};
