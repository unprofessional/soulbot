const { summarizeChatOllama } = require("../../features/ollama");
const { getMessages } = require("../../store/messages.service");

const getRecent50AndSummarizeByChannel = async (message) => {
    const channelId = message.channel.id;
    const messages = await getMessages({ channelId });
    const response = await summarizeChatOllama(messages);
    message.reply(response);
};

module.exports = {
    getRecent50AndSummarizeByChannel,
};
