require('dotenv').config();

// core
const token = process.env.DISCORD_BOT_TOKEN;
const path = process.env.STORE_PATH;
const guildFile = process.env.GUILD_STORE_FILE;
const channelFile = process.env.CHANNEL_STORE_FILE;
const memberFile = process.env.MEMBER_STORE_FILE;
const featureFile = process.env.FEATURE_STORE_FILE;
const runMode = process.env.RUN_MODE || 'development';

// ollama
const ollamaHost = process.env.OLLAMA_HOST || '192.168.7.73';
const ollamaPort = process.env.OLLAMA_PORT || '11434';
const ollamaChatEndpoint = process.env.OLLAMA_CHAT_ENDPOINT || 'api/chat';
const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';

module.exports = {
    token, path, guildFile, channelFile, memberFile, featureFile, runMode,
    ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaModel,
};
