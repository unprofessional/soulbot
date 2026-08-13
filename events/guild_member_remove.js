const { Events } = require('discord.js');
const { resolveGreetingChannel } = require('./guild_greeting_utils.js');
const { recordMemberExit } = require('../store/member_events.js');

const initializeGuildMemberRemove = (client) => {
    // "guildMemberRemove"
    client.on(Events.GuildMemberRemove, async (guildMember) => {
        try {
            await recordMemberExit(guildMember);
        } catch (error) {
            console.error('[member-events] Failed to record member exit:', error);
        }

        const channel = await resolveGreetingChannel(guildMember.guild);
        if (!channel) {
            return;
        }

        await channel.send(`\`${guildMember.user.username}\` left the server!`);
    });

    return client;
};

module.exports = { initializeGuildMemberRemove };
