// store/services/user-profile.service.js

const UserDAO = require('../dao/user.dao.js');
const userDAO = new UserDAO();

async function getOrCreateUser(discordId, role = 'player') {
    const existing = await userDAO.findByDiscordId(discordId);
    if (existing) return existing;
    return await userDAO.create({ discordId, role });
}

async function setCurrentCharacter(discordId, characterId) {
    return await userDAO.setCurrentCharacter(discordId, characterId);
}

async function getCurrentCharacter(discordId) {
    return await userDAO.getCurrentCharacter(discordId);
}

module.exports = {
    getOrCreateUser,
    setCurrentCharacter,
    getCurrentCharacter,
};
