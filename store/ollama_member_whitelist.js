const OllamaWhitelistDAO = require('./dao/ollama_whitelist.dao.js');

const ollamaWhitelistDAO = new OllamaWhitelistDAO();

/**
 * 
 * @param {*} user 
 * @param {*} prefix 
 * @param {*} message 
 * @returns 
 */
const addMember = async (user, prefix, message) => {
    const { id, username } = user;
    const member = await ollamaWhitelistDAO.findByMemberId(id);
    try {
        if(member) {
            throw new Error('Member already exists!');
        }
    }
    catch (err) {
        message.channel.send('Member already exists!');
    }
    message.channel.send(`Adding \`${username}\` to whitelist!`);
    await ollamaWhitelistDAO.save(id);
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
const getMembers = async (client) => {
    const cachedMembers = await initializeMemberCache(client);
    const ollamaWhitelist = await ollamaWhitelistDAO.findAll();
    // console.log('!!!!! cachedGuild: ', cachedMembers); // will print out huge list.....
    const nicknames = [];
    ollamaWhitelist.forEach((_member) => {
        console.log('!!!!! _member: ', _member);
        const cachedMember = cachedMembers.get(_member.member_id);
        console.log('!!!!! cachedMember: ', cachedMember);
        if(!cachedMember) {
            nicknames.push(`MISSING: ${_member.prefix}`);
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
const removeMember = async (memberId) => {
    return await ollamaWhitelistDAO.delete(memberId);
};

/**
 * 
 * @param {*} membersId 
 * @returns true if member is supported
 */
const memberIsControlled = async (memberId) => {
    const member = await ollamaWhitelistDAO.findByMemberId(memberId);
    return Boolean(member);
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
    nickNameIsAlreadySet,
};
