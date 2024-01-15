const { Events } = require('discord.js');

const initializeGuildMemberRemove = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberRemove, (guildMember) => {
        const channel = client.channels.cache.get("1170400835763707946");
        channel.send(`\`${guildMember.user.username}\` left the server!`);
    });

    return client;
};

module.exports = { initializeGuildMemberRemove };
