const DAO = require('./dao/store.dao.js');
require('dotenv').config();
const path = process.env.STORE_PATH;
const file = process.env.GUILD_STORE_FILE;
const filePath = `${path}/${file}`;
const guildDAO = new DAO(filePath);
const guilds = guildDAO.initializeLocalStore().guilds || [];
console.log('>>>>> guilds: ', guilds)

const addGuild = (guildId) => {
    if (guilds.includes(guildId)) {
        return {
            ok: false,
            message: 'Server already exists!',
        };
    }

    guilds.push(guildId);
    guildDAO.save({ guilds });

    return {
        ok: true,
        message: 'Adding server to the list...',
    };
};

const getGuilds = (client) => {
    const guildNames = guilds.map(guildId => {
        const guild = client.guilds.cache.get(guildId);
        return guild?.name || `Unknown guild (${guildId})`;
    });

    console.log('>>>>> guildNames: ', guildNames);
    return guildNames;
};

const removeGuild = (guildId) => {
    const guildIndex = guilds.findIndex(_guildId => _guildId === guildId);

    if (guildIndex === -1) {
        return {
            ok: false,
            message: 'Server is not in the supported list.',
        };
    }

    guilds.splice(guildIndex, 1);
    guildDAO.save({ guilds });

    return {
        ok: true,
        message: 'Removing server from supported list...',
    };
};

/**
 * 
 * @param {*} guildId 
 * @returns true if guild is supported
 */
const guildIsSupported = (guildId) => {
    return guilds.includes(guildId);
};

module.exports = { 
    guilds,
    addGuild,
    getGuilds,
    removeGuild,
    guildIsSupported,
};
