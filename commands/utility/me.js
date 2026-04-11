const { SlashCommandBuilder } = require('discord.js');
const { sendInteractionWebhookProxy } = require('../../features/twitter-core/webhook_utils.js');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '818606180095885332';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('me')
        .setDescription('Post a message as your own short-lived webhook proxy.')
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('text')
                .setDescription('The message to post as your webhook proxy.')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        const text = interaction.options.getString('text', true).trim();
        if (!text) {
            return interaction.reply({
                content: 'Please provide some text to send.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            await sendInteractionWebhookProxy(interaction, text);
            return interaction.editReply({
                content: 'Posted.',
            });
        } catch (error) {
            console.error('Error executing /me:', error);
            return interaction.editReply({
                content: 'Failed to post your webhook proxy message.',
            });
        }
    },
};
