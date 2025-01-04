const { ChromaClient } = require('chromadb');
const net = require('node:net');
const {
    ollamaHost, ollamaPort, ollamaEmbeddingEndpoint, ollamaEmbedModel,
    chromaHost, chromaPort,
} = require('../../config/env_config.js');
const MessageDAO = require('../../store/dao/message.dao.js');

const url = `http://${chromaHost}:${chromaPort}`;
const client = new ChromaClient({
    path: url,
});

async function generateEmbedding(text) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaEmbeddingEndpoint}`;
    console.log('>>>>> embed > generateEmbedding > url: ', url);
    console.log('>>>>> embed > generateEmbedding > ollamaEmbedModel: ', ollamaEmbedModel);

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaEmbedModel, input: text }),
    });

    // console.log('>>>>> embed > generateEmbedding > response status: ', response.status);

    if (!response.ok) {
        throw new Error(`Failed to generate embedding: ${await response.text()}`);
    }

    const responseBody = await response.json(); // Parse JSON body
    console.log('>>>>> embed > generateEmbedding > response body: ', responseBody);

    const { embeddings } = responseBody;
    if (!embeddings || embeddings.length === 0) {
        throw new Error('Embedding data is missing or empty');
    }

    return embeddings[0]; // Assuming single embedding per input
}

async function pushToChromaDb(id, embedding, metadata) {
    try {
        // Convert id to string
        const stringId = id.toString();

        // Specify a name for the collection
        const collectionName = 'discord_messages'; // Change this to your desired collection name

        // Create or retrieve the collection
        let collection = await client.getOrCreateCollection({
            name: collectionName,
        });

        // Add the embedding and metadata to the collection
        await collection.add({
            ids: [stringId],
            embeddings: [embedding],
            metadatas: [metadata],
        });

        console.log(`Message ${id} embedded and stored in ChromaDB.`);
    } catch (err) {
        throw new Error(`Failed to push to ChromaDB: ${err.message}`);
    }
}

async function archiveHistoryToChromaDb() {
    const messages = await new MessageDAO().getAllMessagesToArchive();
    const filteredMessages = messages.filter((msg) => {
        return msg.content !== '[Non-text message]'; // FIXME: Do this at the SQL level!!!!
    });

    for (const message of filteredMessages) {
        const { id, content, user_id, guild_id, channel_id, attachments, created_at } = message;
        console.log('!!! embed > archiveHistoryToChromaDb > message: ', message);
        try {
            // console.log('!!! embed > archiveHistoryToChromaDb > content: ', content);
            const embedding = await generateEmbedding(content);
            // console.log('!!! embed > archiveHistoryToChromaDb > embedding: ', embedding);
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

async function queryChromaDb(queryText, metadataFilters = {}, numResults = 5) {
    try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbedding(queryText);

        // Specify the collection name
        const collectionName = 'discord_messages';

        // Retrieve the collection
        const collection = await client.getCollection({ name: collectionName });

        // Convert metadata filters into a single operator clause
        const whereClause = Object.keys(metadataFilters).length
            ? { $and: Object.entries(metadataFilters).map(([key, value]) => ({ [key]: value })) }
            : undefined;

        // Perform a similarity search
        const results = await collection.query({
            queryEmbeddings: [queryEmbedding], // Search using the query embedding
            nResults: numResults, // Number of results to return
            where: whereClause, // Optional metadata filters with explicit operator
        });

        console.log('>>>>> queryChromaDb > results: ', results);

        return results;
    } catch (err) {
        console.error('Error querying ChromaDB:', err);
        throw new Error(`Failed to query ChromaDB: ${err.message}`);
    }
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
    queryChromaDb,
    testChromaConnection,
};
