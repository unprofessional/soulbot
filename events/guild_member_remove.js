const { Events } = require('discord.js');
const { resolveGreetingChannel } = require('./guild_greeting_utils.js');

const initializeGuildMemberRemove = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberRemove, async (guildMember) => {
        const channel = await resolveGreetingChannel(guildMember.guild);
        if (!channel) {
            return;
        }

        channel.send(`\`${guildMember.user.username}\` left the server!`);
    });

    return client;
};

module.exports = { initializeGuildMemberRemove };
