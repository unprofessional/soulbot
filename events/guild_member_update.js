// events/guild_member_update.js

const { Events } = require('discord.js');
const {
    members,
    memberIsControlled,
    nickNameIsAlreadySet,
} = require('../store/members.js');
const { guildIsSupported } = require('../store/guilds.js');

const initializeGuildMemberUpdate = (client) => {
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const guildId = oldMember.guild.id;

        // Hard-coded channel for logging (dev server #general)
        const channel = client.channels.cache.get('1170400835763707946');

        if (!guildIsSupported(guildId)) {
            console.log('🚫 Unsupported guild. Ignoring GuildMemberUpdate event.');
            channel?.send('Server is not in the supported list. Ignoring...');
            return;
        }

        console.log('📣 GuildMemberUpdate event fired in supported guild.');

        // Handle nickname changes
        if (oldMember.nickname !== newMember.nickname) {
            const oldNick = oldMember.nickname || oldMember.user.username;
            const newNick = newMember.nickname || newMember.user.username;

            console.log('📝 Nickname change detected.');
            channel?.send(`\`${oldMember.user.username}\` changed nickname from **${oldNick}** to **${newNick}**.`);

            if (!memberIsControlled(oldMember.id)) {
                console.log('🛑 Member not controlled. Ignoring nickname enforcement.');
                return;
            }

            const record = members.find((m) => m.memberId === oldMember.id);
            const nicknamePrefix = record?.prefix;

            if (!nicknamePrefix) {
                console.warn('⚠️ No prefix found for controlled member. Skipping nickname update.');
                return;
            }

            if (nickNameIsAlreadySet(newNick, nicknamePrefix)) {
                console.log('✅ Nickname already set with prefix. Skipping.');
                return;
            }

            const replacement = `[${nicknamePrefix}] ${newNick}`.substring(0, 31);

            try {
                const member = client.guilds.cache.get(guildId)?.members.cache.get(oldMember.id);
                await member?.setNickname(replacement);
                console.log(`✏️ Updated nickname to: ${replacement}`);
            } catch (err) {
                console.error('❌ Failed to set nickname:', err);
                channel?.send('There was a problem trying to set the nickname for this user.');
            }
        }

        // Handle role changes (basic diffing by count)
        const oldRoles = oldMember.roles.cache.size;
        const newRoles = newMember.roles.cache.size;

        if (oldRoles !== newRoles) {
            console.log('🎭 Role count changed.');
            channel?.send(`\`${newMember.user.username}\` has had a role added or removed.`);
        }
    });

    return client;
};

module.exports = { initializeGuildMemberUpdate };
