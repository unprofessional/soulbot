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
const ollamaEmbeddingEndpoint = process.env.OLLAMA_EMBEDDING_ENDPOINT || 'api/embed';
const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2-vision:11b';
const ollamaEmbedModel = process.env.OLLAMA_EMBED_MODEL || 'avr/sfr-embedding-mistral:q4_k_m';

// postgres
const pgHost = process.env.PG_HOST;
const pgPort = process.env.PG_PORT;
const pgUser = process.env.PG_USER;
const pgPass = process.env.PG_PASS;
const pgDb = process.env.PG_DB;

// chroma
const chromaHost = process.env.CHROMA_HOST || 'http://host.minikube.internal';
const chromaPort = process.env.CHROMA_PORT || '8085';
const chromaUpsertEndpoint = process.env.CHROMA_UPSERT_ENDPOINT || 'api/v1/upsert';

module.exports = {
    token, path, guildFile, channelFile, memberFile, featureFile, runMode,
    ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaEmbeddingEndpoint, ollamaModel, ollamaEmbedModel,
    pgHost, pgPort, pgUser, pgPass, pgDb,
    chromaHost, chromaPort, chromaUpsertEndpoint,
};
