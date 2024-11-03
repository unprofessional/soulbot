const DAO = require('./store.dao.js');
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
const addMember = (user, prefix, message) => {
    const { id, username } = user;
    const member = members.find((_member) => _member.memberId === id);
    try {
        if(member) {
            throw new Error('Member already exists!');
        }
    }
    catch (err) {
        message.channel.send('Member already exists!');
    }
    message.channel.send(`Adding \`${username}\` with prefix: \`${prefix}\`...`);
    members.push({
        memberId: id,
        prefix,
    });
    memberDAO.save({ members });
};

/**
 * 
 * @param {*} client 
 * @param {*} guildId 
 * @returns 
 */
const initializeMemberCache = async (client) => {
    const cachedGuild = client.guilds.cache.get('818606858780147712');
    if (!cachedGuild) {
        console.error("Guild not found!");
        return;
    }
    try {
        await cachedGuild.members.fetch(); // Fetch and cache all members at once
        console.log("All members cached successfully.");
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
const getMembers = async (client) => {
    const cachedGuild = await initializeMemberCache(client);
    console.log('!!!!! cachedGuild: ', cachedGuild);
    const nicknames = [];
    members.forEach((_member) => {
    console.log('!!!!! _member: ', _member);
        const cachedMember = cachedGuild.members.cache.get(_member.memberId); // use `fetch` instead of `get` since v14
        console.log('!!!!! cachedMember: ', cachedMember);
        if(!cachedMember) {
            nicknames.push(`member not found: ${_member.prefix}`);
        } else {
            nicknames.push(cachedMember.nickname);
        }
    });

    let nicknamesStringFormatted = "";
    nicknames.forEach((nickname) => {
        nicknamesStringFormatted += `\`${nickname}\`, ` // TODO: fix singular dangling comma
    })
    console.log('>>>>> nicknamesStringFormatted: ', nicknamesStringFormatted);
    return nicknamesStringFormatted;
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
