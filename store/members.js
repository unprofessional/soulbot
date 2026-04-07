const MemberDAO = require('./dao/member.dao.js');

const memberDAO = new MemberDAO();

/**
 * 
 * @param {*} user 
 * @param {*} prefix 
 * @param {*} message 
 * @returns 
 */
const addMember = async (user, prefix) => {
    const { id, username } = user;
    const member = await memberDAO.findByMemberId(id);

    if (member) {
        return {
            ok: false,
            message: 'Member already exists!',
        };
    }

    await memberDAO.save({
        memberId: id,
        prefix,
    });

    return {
        ok: true,
        message: `Adding \`${username}\` with prefix: \`${prefix}\`...`,
    };
};

/**
 * 
 * @param {*} client 
 * @param {*} guildId 
 * @returns 
 */
const initializeMemberCache = async (client, guildId) => {
    const cachedGuild = client.guilds.cache.get(guildId);
    if (!cachedGuild) {
        console.error("Guild not found!");
        return;
    }
    try {
        const fetchedMembers = await cachedGuild.members.fetch(); // Fetch and cache all members at once
        console.log("All members cached successfully!"); // DO NOT PRINT MEMBERS, LIST WILL BE HUGE!
        return fetchedMembers;
    } catch (error) {
        console.error("Error fetching members for cache:", error);
    }
};

/**
 * 
 * @param {*} client 
 * @param {*} guildId 
 * @returns 
 */
const getMembers = async (client, guildId) => {
    const cachedMembers = await initializeMemberCache(client, guildId);
    if (!cachedMembers) return [];
    const members = await memberDAO.findAll();

    // console.log('!!!!! cachedGuild: ', cachedMembers); // will print out huge list.....
    const nicknames = [];
    members.forEach((_member) => {
        console.log('!!!!! _member: ', _member);
        const cachedMember = cachedMembers.get(_member.member_id);
        console.log('!!!!! cachedMember: ', cachedMember);
        if(!cachedMember) {
            nicknames.push(`MISSING: ${_member.prefix}`);
        } else {
            nicknames.push(cachedMember.nickname || cachedMember.user.username);
        }
    });

    console.log('>>>>> nicknames: ', nicknames);
    return nicknames;
};

/**
 * 
 * @param {*} membersId 
 * @returns 
 */
const removeMember = async (memberId) => {
    return await memberDAO.delete(memberId);
};

/**
 * 
 * @param {*} membersId 
 * @returns true if member is supported
 */
const memberIsControlled = async (memberId) => {
    const member = await memberDAO.findByMemberId(memberId);
    return Boolean(member);
};

const getMemberRecord = async (memberId) => {
    const member = await memberDAO.findByMemberId(memberId);
    if (!member) return null;
    return {
        memberId: member.member_id,
        prefix: member.prefix,
    };
};

/**
 * 
 * @param {*} nickname 
 * @param {*} prefix 
 * @returns 
 */
const nickNameIsAlreadySet = (nickname, prefix) => {
    if(!nickname || nickname === '') {
        return false;
    }
    const startsWithSquareBracket = nickname.substring(0,1) === '[';
    const pattern = /[\[\]]+/; // eslint-disable-line no-useless-escape
    const nicknameArr = nickname.split(pattern);
    const containsPrefix = nicknameArr[1] === prefix;
    return startsWithSquareBracket && containsPrefix;
};

module.exports = { 
    addMember,
    getMembers,
    removeMember,
    memberIsControlled,
    getMemberRecord,
    nickNameIsAlreadySet,
};
