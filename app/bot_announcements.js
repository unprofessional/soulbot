const { getBotAnnouncementChannels } = require('../store/guilds.js');

const ONLINE_ANNOUNCEMENT = 'Soulbot is back online.';
const RESTART_ANNOUNCEMENT = 'Soulbot is restarting for an update. I will be back shortly.';

async function resolveAnnouncementChannel(client, { guildId, channelId }) {
    const guild = client.guilds.cache.get(guildId)
        || await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) return null;

    const channel = guild.channels.cache.get(channelId)
        || await guild.channels.fetch(channelId).catch(() => null);

    if (!channel || channel.guildId !== guildId) return null;
    if (typeof channel.isTextBased !== 'function' || !channel.isTextBased()) return null;

    return channel;
}

async function sendBotAnnouncement(client, {
    eventName,
    message,
}) {
    if (!client?.isReady?.()) {
        console.warn(`[bot-announcements] Skipping ${eventName} announcement because Discord client is not ready.`);
        return { sent: 0, failed: 0, skipped: 0 };
    }

    const configuredChannels = await getBotAnnouncementChannels();
    console.log(`[bot-announcements] Found ${configuredChannels.length} configured announcement channel(s) for ${eventName}.`);

    const results = await Promise.all(configuredChannels.map(async (config) => {
        try {
            console.log(
                `[bot-announcements] Resolving announcement channel guild=${config.guildId} channel=${config.channelId}`
            );
            const channel = await resolveAnnouncementChannel(client, config);
            if (!channel) {
                console.warn(
                    `[bot-announcements] Skipping unresolved announcement channel guild=${config.guildId} channel=${config.channelId}`
                );
                return 'skipped';
            }

            await channel.send(message);
            return 'sent';
        } catch (error) {
            console.error(
                `[bot-announcements] Failed to send ${eventName} announcement for guild=${config.guildId} channel=${config.channelId}:`,
                error
            );
            return 'failed';
        }
    }));

    return results.reduce((summary, result) => ({
        ...summary,
        [result]: summary[result] + 1,
    }), { sent: 0, failed: 0, skipped: 0 });
}

async function announceBotRestart(client, message = RESTART_ANNOUNCEMENT) {
    return sendBotAnnouncement(client, {
        eventName: 'restart',
        message,
    });
}

async function announceBotOnline(client, message = ONLINE_ANNOUNCEMENT) {
    return sendBotAnnouncement(client, {
        eventName: 'online',
        message,
    });
}

module.exports = {
    ONLINE_ANNOUNCEMENT,
    RESTART_ANNOUNCEMENT,
    announceBotOnline,
    announceBotRestart,
    resolveAnnouncementChannel,
    sendBotAnnouncement,
};
