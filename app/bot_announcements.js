const { getBotAnnouncementChannels } = require('../store/guilds.js');

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

async function announceBotRestart(client, message = RESTART_ANNOUNCEMENT) {
    if (!client?.isReady?.()) {
        console.warn('[bot-announcements] Skipping restart announcement because Discord client is not ready.');
        return { sent: 0, failed: 0, skipped: 0 };
    }

    const configuredChannels = await getBotAnnouncementChannels();
    console.log(`[bot-announcements] Found ${configuredChannels.length} configured announcement channel(s).`);

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
                `[bot-announcements] Failed to send restart announcement for guild=${config.guildId} channel=${config.channelId}:`,
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

module.exports = {
    RESTART_ANNOUNCEMENT,
    announceBotRestart,
    resolveAnnouncementChannel,
};
