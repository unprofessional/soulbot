const { SlashCommandBuilder } = require('discord.js');
const { deleteMessage, getMessageById } = require('../../store/services/messages.service.js');

function parseTarget(rawTarget, fallbackChannelId) {
    const target = String(rawTarget || '').trim();
    if (!target) return null;

    const linkMatch = target.match(/^https:\/\/discord\.com\/channels\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (linkMatch) {
        return {
            guildId: linkMatch[1],
            channelId: linkMatch[2],
            messageId: linkMatch[3],
        };
    }

    if (/^\d+$/.test(target)) {
        return {
            guildId: null,
            channelId: fallbackChannelId,
            messageId: target,
        };
    }

    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-tweet-render')
        .setDescription('Delete one of your tracked tweet render messages.')
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('target')
                .setDescription('A Discord message link or message ID for the rendered tweet post.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const rawTarget = interaction.options.getString('target');
        const parsedTarget = parseTarget(rawTarget, interaction.channelId);

        if (!parsedTarget) {
            return interaction.reply({
                content: 'Provide a valid Discord message link or message ID.',
                ephemeral: true,
            });
        }

        if (parsedTarget.guildId && parsedTarget.guildId !== interaction.guildId) {
            return interaction.reply({
                content: 'That message is not in this server.',
                ephemeral: true,
            });
        }

        const record = await getMessageById(parsedTarget.messageId);

        if (!record || record.meta?.kind !== 'twitter_render') {
            return interaction.reply({
                content: 'That message is not a tracked tweet render, or it predates ownership tracking.',
                ephemeral: true,
            });
        }

        if (String(record.meta?.owningUserId || '') !== String(interaction.user.id)) {
            return interaction.reply({
                content: 'You can only delete tweet renders you own.',
                ephemeral: true,
            });
        }

        const channelId = parsedTarget.channelId || record.channel_id;

        if (!channelId) {
            return interaction.reply({
                content: 'I could not resolve the channel for that message.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        let discordDeleteSucceeded = false;

        try {
            const channel = await interaction.client.channels.fetch(channelId);
            if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased()) {
                throw new Error('Target channel is not text-based.');
            }

            const targetMessage = await channel.messages.fetch(parsedTarget.messageId);
            await targetMessage.delete();
            discordDeleteSucceeded = true;
        } catch (error) {
            console.warn('[delete-tweet-render] Discord delete failed, falling back to DB-only cleanup:', error);
        }

        await deleteMessage(parsedTarget.messageId);

        return interaction.editReply({
            content: discordDeleteSucceeded
                ? 'Deleted your tweet render.'
                : 'The Discord message was already gone or unreachable, but its tracked record has been cleaned up.',
        });
    },
};
