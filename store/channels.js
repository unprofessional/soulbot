const ChannelDAO = require('./dao/channel.dao.js');

const channelDAO = new ChannelDAO();

const getChannels = async () => {
    const channels = await channelDAO.findAll();
    return channels.map(({ channel_id: channelId }) => channelId);
};

const addChannel = async (channelId) => {
    return await channelDAO.save(channelId);
};

const removeChannel = async (channelId) => {
    return await channelDAO.delete(channelId);
};

const channelIsTracked = async (channelId) => {
    return await channelDAO.exists(channelId);
};

module.exports = { 
    getChannels,
    addChannel,
    removeChannel,
    channelIsTracked,
};
