const { Events } = require('discord.js');
const {
  members,
  addMember,
  getMembers,
  // removeMember,
  memberIsControlled,
  nickNameIsAlreadySet,
} = require("../store/members.js");
const { guildIsSupported } = require('../store/guilds.js');

const initializeEvents = (client) => {
  /**
   * Exclusive to ANY server member updates (i.e. nickname change, role change, etc)
   * 
   * For initial manual first adds, see `/message_listeners/core.js`
   */
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    // TODO:
    /**
     * 1) [DONE] White List Servers/Guilds (by guildId?)
     * 2) get desired channelId to notify of changes (OPTIONAL)
     * 3) [DONE in core.js] abstract functionality to manually set "guild.member.nickname" suffix
     */

    // FIXME: Hard-coded for now... "personal dev server" #general
    const channel = client.channels.cache.get("1170400835763707946");

    // Guild MUST be part of a white list
    if(guildIsSupported(oldMember.guild.id)) {
      channel.send(`\`${oldMember.user.username}\` has changed their nickname from ${oldMember.nickname} to ${newMember.nickname}!`);
      /**
       * This will include some gating-logic since the bot's namechange will trigger this
       * and if we don't capture the scenario, it can be an infinite loop....
       */
      // member must be on the controlledMember list
      if(memberIsControlled(oldMember.id)) {
        const nicknamePrefix = members.find((_member) => oldMember.id === _member.memberId).prefix;
        // console.log('>>>>> nicknamePrefix: ', nicknamePrefix);
        if(!nickNameIsAlreadySet(newMember.nickname, nicknamePrefix)) {
          const guildId = oldMember.guild.id;
          const cachedGuild = client.guilds.cache.get(guildId);
          const cachedMember = cachedGuild.members.cache.get(oldMember.id);
          // Max-length for nicks is 32 chars
          const replacementNickname = `[${nicknamePrefix}] ${newMember.nickname || user.username}`.substring(0,31);
          try {
            await cachedMember.setNickname(replacementNickname);
          }
          catch (err) {
            channel.send('There was a problem trying to set the nickname for this user!');
          }
        }
        else {
          channel.send('Nick is already set! Ignoring...');
          console.log('>>>>> Member nickname already set! Ignoring...');
          return;
        }
      }
      else {
        channel.send('Member not in the controlled list! ignoring...');
        console.log('>>>>> Member IS NOT in the controlled list! Ignoring...');
      }
    }
    else {
      channel.send('Server IS NOT in the supported list! Ignoring...');
      console.log('>>>>> Server IS NOT in the supported list! Ignoring...');
    }
  });

  return client;
};

module.exports = { initializeEvents };
