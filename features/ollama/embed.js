const net = require('node:net');

const {
    ollamaHost, ollamaPort, ollamaEmbeddingEndpoint, ollamaEmbedModel,
    chromaHost, chromaPort, chromaUpsertEndpoint,
} = require('../../config/env_config.js');
const MessageDAO = require('../../store/dao/message.dao.js');

async function generateEmbedding(text) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaEmbeddingEndpoint}`;
    console.log('>>>>> embed > generateEmbedding > url: ', url);
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaEmbedModel, text }),
    });

    if (!response.ok) {
        throw new Error(`Failed to generate embedding: ${await response.text()}`);
    }

    const { embedding } = await response.json();
    return embedding;
}

async function pushToChromaDb(id, embedding, metadata) {
    const url = `http://${chromaHost}:${chromaPort}/${chromaUpsertEndpoint}`;
    console.log('>>>>> embed > pushToChromaDb > url: ', url);
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ids: [id],
            embeddings: [embedding],
            metadata: [metadata],
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to push to ChromaDB: ${await response.text()}`);
    }

    console.log(`Message ${id} embedded and stored in ChromaDB.`);
}

async function archiveHistoryToChromaDb() {
    const messages = await new MessageDAO().getAllMessagesToArchive();
    const filteredMessages = messages.filter((msg) => {
        return msg.content !== '[Non-text message]'; // FIXME: Do this at the SQL level!!!!
    });

    for (const message of filteredMessages) {
        const { id, content, user_id, guild_id, channel_id, attachments, created_at } = message;

        try {
            const embedding = await generateEmbedding(content);
            console.log('>>>>> embed > archiveHistoryToChromaDb > embedding: ', embedding);
            await pushToChromaDb(id, embedding, {
                user_id,
                guild_id,
                channel_id,
                attachments,
                created_at,
            });
        } catch (err) {
            console.error(`Error embedding message ${id}:`, err.message);
            throw new Error(`Failed to process message ${id}: ${err.message}`);
        }
    }

    console.log('Finished embedding historical data.');
}

/**
 * Test ChromaDB connection using pure Node.js
 * @returns {Promise<string>} - A success message or throws an error
 */
async function testChromaConnection() {
    console.log('Testing ChromaDB connection...');
    const timeout = 5000; // 5 seconds timeout

    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        // Handle connection success
        socket.on('connect', () => {
            socket.end();
            resolve('ChromaDB connection successful');
        });

        // Handle errors and timeouts
        const handleError = (err) => {
            socket.destroy();
            reject(new Error(`ChromaDB connection failed: ${err.message}`));
        };

        socket.setTimeout(timeout, () => handleError(new Error('ChromaDB Connection timed out')));
        socket.on('error', handleError);

        // Attempt to connect to ChromaDB host and port
        socket.connect(chromaPort, chromaHost);
    });
}

module.exports = {
    generateEmbedding,
    pushToChromaDb,
    archiveHistoryToChromaDb,
    testChromaConnection,
};
