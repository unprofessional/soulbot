const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const REQUIRED = [[P.ViewChannel, 'View Channel'], [P.ReadMessageHistory, 'Read Message History'], [P.SendMessages, 'Send Messages']];
const OPTIONAL = [[P.AddReactions, 'Add Reactions'], [P.ManageMessages, 'Manage Messages']];
function diagnostics(channel, guild) {
    const permissions = channel?.permissionsFor?.(guild.members.me);
    return {
        required: REQUIRED.filter(([bit]) => !permissions?.has(bit)).map(([, name]) => name),
        optional: OPTIONAL.filter(([bit]) => !permissions?.has(bit)).map(([, name]) => name),
    };
}
function canRead(channel, viewer, guildId) {
    return channel?.guildId === guildId && channel.type === ChannelType.GuildText
        && Boolean(channel.permissionsFor(viewer)?.has([P.ViewChannel, P.ReadMessageHistory]));
}
async function refresh(guild, userId) {
    const [viewer, channels, roles] = await Promise.all([
        guild.members.fetch({ user: userId, force: true }), guild.channels.fetch(), guild.roles.fetch(), guild.members.fetchMe({ force: true }),
    ]);
    return { viewer, channels, roles };
}
function target(context, guildId, channelId) {
    const channel = context.channels.get(channelId);
    if (!canRead(channel, context.viewer, guildId)) {
        throw Object.assign(new Error('Open a text channel you can view and read, or ask a manager for access.'), { userFacing: true });
    }
    return channel;
}
module.exports = { diagnostics, canRead, refresh, target };
