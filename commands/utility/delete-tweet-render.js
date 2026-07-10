const { SlashCommandBuilder } = require('discord.js');
const {
    deleteMessage,
    findTweetRenderByOriginalLink,
    getMessageById,
} = require('../../store/services/messages.service.js');

function parseTarget(rawTarget, fallbackChannelId) {
    const target = String(rawTarget || '').trim().replace(/^<|>$/g, '');
    if (!target) return null;

    if (/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/i.test(target)) {
        return {
            type: 'tweet_link',
            url: target,
        };
    }

    const linkMatch = target.match(/^https:\/\/discord\.com\/channels\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (linkMatch) {
        return {
            type: 'discord_message',
            guildId: linkMatch[1],
            channelId: linkMatch[2],
            messageId: linkMatch[3],
        };
    }

    if (/^\d+$/.test(target)) {
        return {
            type: 'discord_message',
            guildId: null,
            channelId: fallbackChannelId,
            messageId: target,
        };
    }

    return null;
}

async function deleteTrackedTweetRender(interaction, {
    parsedTarget,
    notFoundMessage = 'That message is not a tracked tweet render, or it predates ownership tracking.',
} = {}) {
    const record = parsedTarget.type === 'tweet_link'
        ? await findTweetRenderByOriginalLink(interaction.guildId, parsedTarget.url)
        : await getMessageById(parsedTarget.messageId);

    if (!record || record.meta?.kind !== 'twitter_render') {
        return interaction.reply({
            content: notFoundMessage,
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
    const messageId = parsedTarget.messageId || record.message_id;

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

        const targetMessage = await channel.messages.fetch(messageId);
        await targetMessage.delete();
        discordDeleteSucceeded = true;
    } catch (error) {
        console.warn('[delete-tweet-render] Discord delete failed, falling back to DB-only cleanup:', error);
    }

    await deleteMessage(messageId);

    return interaction.editReply({
        content: discordDeleteSucceeded
            ? 'Deleted your tweet render.'
            : 'The Discord message was already gone or unreachable, but its tracked record has been cleaned up.',
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-tweet-render')
        .setDescription('Delete one of your tracked tweet render messages.')
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('target')
                .setDescription('A rendered tweet message link/ID, or the original X/Twitter URL.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const rawTarget = interaction.options.getString('target');
        const parsedTarget = parseTarget(rawTarget, interaction.channelId);

        if (!parsedTarget) {
            return interaction.reply({
                content: 'Provide a valid rendered tweet message link/ID, or the original X/Twitter URL.',
                ephemeral: true,
            });
        }

        if (parsedTarget.guildId && parsedTarget.guildId !== interaction.guildId) {
            return interaction.reply({
                content: 'That message is not in this server.',
                ephemeral: true,
            });
        }

        return deleteTrackedTweetRender(interaction, {
            parsedTarget,
        });
    },

    parseTarget,
    deleteTrackedTweetRender,
};
