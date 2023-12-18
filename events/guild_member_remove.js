const { Events } = require('discord.js');

const initializeGuildMemberRemove = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberAdd, (guildMember) => {
        const channel = client.channels.cache.get("1170400835763707946");
        channel.send(`GuildMemberRemove: ${guildMember.user.username} left the server!`);
    });

    return client;
};

module.exports = { initializeGuildMemberRemove };
