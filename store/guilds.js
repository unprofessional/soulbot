const GuildDAO = require('./dao/guild.dao.js');

const guildDAO = new GuildDAO();

const addGuild = async (guildId) => {
    const existingGuild = await guildDAO.findByGuildId(guildId);
    const existingMeta = existingGuild?.meta || {};
    const alreadySupported = existingGuild
        && (existingMeta.supported === true || Object.keys(existingMeta).length === 0);

    if (alreadySupported) {
        return {
            ok: false,
            message: 'Server already exists!',
        };
    }

    await guildDAO.updateMeta(guildId, {
        ...existingMeta,
        supported: true,
    });

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
    const record = await guildDAO.findByGuildId(guildId);
    if (!record) {
        return false;
    }

    const meta = record.meta || {};
    if (typeof meta.supported === 'boolean') {
        return meta.supported;
    }

    // Legacy rows used existence alone to mean "supported".
    return Object.keys(meta).length === 0;
};

const getGuild = async (guildId) => {
    return await guildDAO.findByGuildId(guildId);
};

const getGuildMeta = async (guildId) => {
    const record = await guildDAO.findByGuildId(guildId);
    return record?.meta || {};
};

const updateGuildMeta = async (guildId, updater) => {
    const currentMeta = await getGuildMeta(guildId);
    const nextMeta = typeof updater === 'function'
        ? updater(currentMeta)
        : {
            ...currentMeta,
            ...(updater || {}),
        };

    await guildDAO.updateMeta(guildId, nextMeta);
    return nextMeta;
};

const getGreetingChannelId = async (guildId) => {
    const meta = await getGuildMeta(guildId);
    return meta?.greetingChannelId || null;
};

const setGreetingChannelId = async (guildId, channelId) => {
    const meta = await updateGuildMeta(guildId, (currentMeta) => ({
        ...currentMeta,
        greetingChannelId: String(channelId),
    }));

    return meta.greetingChannelId;
};

const clearGreetingChannelId = async (guildId) => {
    const meta = await updateGuildMeta(guildId, (currentMeta) => {
        const nextMeta = { ...currentMeta };
        delete nextMeta.greetingChannelId;
        return nextMeta;
    });

    return meta;
};

module.exports = { 
    addGuild,
    clearGreetingChannelId,
    getGreetingChannelId,
    getGuild,
    getGuildMeta,
    getGuilds,
    removeGuild,
    setGreetingChannelId,
    updateGuildMeta,
    guildIsSupported,
};
