const DAO = require('./dao/store.dao.js');
require('dotenv').config();
const path = process.env.STORE_PATH;
const file = process.env.MEMBER_STORE_FILE;
const filePath = `${path}/${file}`;
const memberDAO = new DAO(filePath);
const members = memberDAO.initializeLocalStore().members || [];
console.log('>>>>> members: ', members)

/**
 * 
 * @param {*} user 
 * @param {*} prefix 
 * @param {*} message 
 * @returns 
 */
const addMember = (user, prefix) => {
    const { id, username } = user;
    const member = members.find((_member) => _member.memberId === id);

    if (member) {
        return {
            ok: false,
            message: 'Member already exists!',
        };
    }

    members.push({
        memberId: id,
        prefix,
    });
    memberDAO.save({ members });

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

    // console.log('!!!!! cachedGuild: ', cachedMembers); // will print out huge list.....
    const nicknames = [];
    members.forEach((_member) => {
        console.log('!!!!! _member: ', _member);
        const cachedMember = cachedMembers.get(_member.memberId);
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
const removeMember = (membersId) => {
    return members.filter((_membersId) => _membersId === membersId);
};

/**
 * 
 * @param {*} membersId 
 * @returns true if member is supported
 */
const memberIsControlled = (memberId) => {
    // console.log('>>>>> memberIsControlled > memberId: ', memberId);
    // console.log('>>>>> memberIsControlled > members: ', members);
    const member = members.find((_member) => _member.memberId === memberId);
    if(member) return true;
    return false;
}

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
    members,
    addMember,
    getMembers,
    removeMember,
    memberIsControlled,
    nickNameIsAlreadySet,
};
