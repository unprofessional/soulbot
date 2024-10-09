const { Events } = require('discord.js');

const initializeGuildMemberRemove = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberRemove, (guildMember) => {
        const channel = client.channels.cache.get("917909802485678143");
        channel.send(`\`${guildMember.user.username}\` left the server!`);
    });

    return client;
};

module.exports = { initializeGuildMemberRemove };
