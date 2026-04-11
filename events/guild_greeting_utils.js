const { getGreetingChannelId } = require('../store/guilds.js');

async function resolveGreetingChannel(guild) {
    if (!guild) return null;

    const channelId = await getGreetingChannelId(guild.id);
    if (!channelId) return null;

    const channel = guild.channels.cache.get(channelId)
        || await guild.channels.fetch(channelId).catch(() => null);

    if (!channel || channel.guildId !== guild.id) return null;
    if (typeof channel.isTextBased !== 'function' || !channel.isTextBased()) return null;

    return channel;
}

module.exports = {
    resolveGreetingChannel,
};
