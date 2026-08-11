const MemberEventDAO = require('./dao/member_event.dao.js');

const memberEventDAO = new MemberEventDAO();

function memberEventIdentity(guildMember) {
    return {
        guildId: guildMember.guild.id,
        memberId: guildMember.user.id,
        username: guildMember.user.username || null,
        globalName: guildMember.user.globalName || null,
        displayName: guildMember.displayName
            || guildMember.user.globalName
            || guildMember.user.username
            || null,
    };
}

async function recordMemberEntry(guildMember) {
    const event = await memberEventDAO.record({
        ...memberEventIdentity(guildMember),
        eventType: 'join',
    });
    return Number(event?.join_count) || 1;
}

async function recordMemberExit(guildMember) {
    return memberEventDAO.record({
        ...memberEventIdentity(guildMember),
        eventType: 'leave',
    });
}

module.exports = {
    memberEventIdentity,
    recordMemberEntry,
    recordMemberExit,
};
