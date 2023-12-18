const { Events } = require('discord.js');
// const {
//   members,
//   addMember,
//   getMembers,
//   // removeMember,
//   memberIsControlled,
//   nickNameIsAlreadySet,
// } = require("../store/members.js");
// const { guildIsSupported } = require('../store/guilds.js');

const initializeGuildMemberAdd = (client) => {
  // "guildMemberAdd"
  client.on(Events.GuildMemberAdd, (payload) => {

    console.log('>>>>> GuildMemberAdd event fired! payload: ', payload);

    // FIXME: Hard-coded for now... "personal dev server" #general
    // const channel = client.channels.cache.get("1170400835763707946");
    // console.log('>>>>> channel: ', channel);
    // const user = client.members.cache.get();
    // channel.send(`GuildMemberAdd: ${user}`)

    // Guild MUST be part of a white list
    // if(guildIsSupported(oldMember.guild.id)) { // FIXME: no access to oldMember here
    //   console.log('>>>>> GUILD SUPPORTED: GuildMemberAdd event fired!');

    //   console.log('>>>>> GUILD SUPPORTED: GuildMemberAdd event fired!');

    // }
    // else {
    //   console.log('>>>>> Server IS NOT in the supported list! Ignoring...');
    //   channel.send('Server IS NOT in the supported list! Ignoring...');
    // }


  });

  return client;
};

module.exports = { initializeGuildMemberAdd };
