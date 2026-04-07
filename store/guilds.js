const GuildDAO = require('./dao/guild.dao.js');

const guildDAO = new GuildDAO();

const addGuild = async (guildId) => {
    const exists = await guildDAO.exists(guildId);
    if (exists) {
        return {
            ok: false,
            message: 'Server already exists!',
        };
    }

    await guildDAO.save(guildId);

    return {
        ok: true,
        message: 'Adding server to the list...',
    };
};

const getGuilds = async (client) => {
    const guilds = await guildDAO.findAll();
    const guildNames = guilds.map(({ guild_id: guildId }) => {
        const guild = client.guilds.cache.get(guildId);
        return guild?.name || `Unknown guild (${guildId})`;
    });

    console.log('>>>>> guildNames: ', guildNames);
    return guildNames;
};

const removeGuild = async (guildId) => {
    const deleted = await guildDAO.delete(guildId);
    if (!deleted) {
        return {
            ok: false,
            message: 'Server is not in the supported list.',
        };
    }

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
const guildIsSupported = async (guildId) => {
    return await guildDAO.exists(guildId);
};

module.exports = { 
    addGuild,
    getGuilds,
    removeGuild,
    guildIsSupported,
};
