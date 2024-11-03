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
const getMembers = (client, guildId) => {
    const cachedGuild = client.guilds.cache.get(guildId);
    console.log('!!!!! cachedGuild: ', cachedGuild);
    const nicknames = [];
    members.forEach((_member) => {
    console.log('!!!!! _member: ', _member);
        const cachedMember = cachedGuild.members.cache.fetch(_member.memberId); // use `fetch` instead of `get` since v14
        console.log('!!!!! cachedMember: ', cachedMember);
        if(!cachedMember) {
            nicknames.push('UNDEFINED! Deleted member: ', _member.prefix);
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
