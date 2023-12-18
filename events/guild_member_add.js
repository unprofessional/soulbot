const { Events } = require('discord.js');

const initializeGuildMemberAdd = (client) => {
  // "guildMemberAdd"
  client.on(Events.GuildMemberAdd, (guildMember) => {
    const channel = client.channels.cache.get("1170400835763707946");
    channel.send(`GuildMemberAdd: ${guildMember.user.username} joined the server!`);
  });

  return client;
};

module.exports = { initializeGuildMemberAdd };
