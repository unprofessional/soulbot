const {
    ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaModel,
} = require('../../config/env_config.js');
const { queryChromaDb } = require('./embed.js');

const processChunks = async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let responseText = '';
    let fullContent = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseText += decoder.decode(value, { stream: true });

        // Process each JSON line in the stream
        const lines = responseText.split('\n').filter(line => line.trim()); // Handle multiple chunks
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line); // Parse JSON chunk
                if (parsed.message && parsed.message.content) {
                    fullContent += parsed.message.content; // Concatenate content
                }
            } catch (err) {
                console.error('Error parsing chunk:', line, err);
            }
        }

        // Reset responseText after processing to handle partial messages correctly
        responseText = '';
    }
    return fullContent;
};

async function sendPromptToOllama(prompt, imagePath, intent) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;
    let finalUserPrompt = imagePath
        ? 'Analyze this image. Please be brief and concise. If you do not know what it is, then just say so.'
        : prompt;
    if(intent === 'catvision') {
        finalUserPrompt = `You are assisting with categorizing images into categories for a database. 
Analyze the provided image and return suggested meta tags in JSON format. 

The tags should be single words or short phrases. 
Output the tags in the following JSON schema **and nothing else**:

{
  "suggestedTags": ["category1", "category2", "category3"]
}

Do not include explanations, descriptions, or any additional text. 
Your output should only contain valid JSON in the format provided.

Example input: An image of a dog playing in a park.
Example output:
{
  "suggestedTags": ["dog", "park", "play", "outdoor"]
}

Categorize the image now and follow the JSON schema strictly.
`;
    }
    const requestBody = {
        model: ollamaModel,
        messages: [
            {
                role: 'system',
                content: 'You are a sassy and condescending. ' +
                'Answer in plain text. Keep it simple and to the point. Do not exceed 2000 characters. ' + 
                'Each request is in a vacuum since you are being prompted in single-use sessions each time, therefore you cannot remember past references from the user. ' +
                'Answer questions about the world truthfully. ',
            },
            {
                role: 'user',
                content: finalUserPrompt,
                ...(imagePath && { images: [imagePath] }), // Conditionally add 'images' property
            },
        ],
        keepAlive: -1, // Keep model in memory
    };

    console.log('>>>>> ollama > sendPromptToOllama > requestBody: ', requestBody);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        let fullContent = await processChunks(response);

        console.log('Full concatenated content:', fullContent);
        return fullContent; // Return the fully concatenated response
    } catch (error) {
        console.error('Error communicating with Ollama API:', error);
        throw error;
    }
}

async function summarizeChatOllama(messages) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;
    const formattedMessages = messages.map(msg => {
        return `(${msg.created_at.toISOString()}) [${msg.user_id}]: ${msg.content}`;
    }).join('\n');
    let finalUserPrompt = `${formattedMessages}`;
    const requestBody = {
        model: ollamaModel,
        messages: [
            {
                role: 'system',
                content: 'Summarize the Discord chat logs. ' +
                'Be sassy and condescending about your summary. ' +
                'Be brief and simple. ' + 
                'If you do not know, just say you do not know. ' +
                'If citing a user, remember to properly mention them via <@memberID>.',
            },
            {
                role: 'user',
                content: 'Summarize the Discord chat logs. ' +
                'Be sassy and condescending about your summary. ' +
                'Be brief and simple. ' + 
                'If you do not know, just say you do not know. ' +
                'If citing a user, remember to properly mention them via <@memberID>.',
            },
        ],
        keepAlive: -1, // Keep model in memory
    };

    console.log('>>>>> ollama > summarizeChatOllama > requestBody: ', requestBody);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        let fullContent = await processChunks(response);

        console.log('Full concatenated content:', fullContent);
        return fullContent; // Return the fully concatenated response
    } catch (error) {
        console.error('Error communicating with Ollama API:', error);
        throw error;
    }
}

/**
 * Queries ChromaDB for relevant context and sends a RAG-enhanced query to the LLM.
 * @param {string} userQuery - The user's query.
 * @param {Object} metadataFilters - Optional filters for ChromaDB (e.g., guild_id, channel_id).
 * @param {number} numResults - The number of relevant results to retrieve from ChromaDB.
 * @returns {Promise<string>} - The response from the LLM.
 */
async function queryWithRAG(userQuery, metadataFilters = {}, numResults = 20) {
    try {
        // Step 1: Query ChromaDB for relevant context
        const results = await queryChromaDb(userQuery, metadataFilters, numResults);

        // Step 2: Extract and filter context
        const contextArray = results.metadatas[0]
            .map((metadata) => {
                if (
                    metadata?.content &&
                    metadata?.created_at &&
                    !metadata.content.includes('Member not in the controlled list!')
                ) {
                    return `${metadata.created_at}: ${metadata.content}`;
                }
                return null; // Skip invalid or irrelevant metadata
            })
            .filter(Boolean); // Remove null entries

        const context = contextArray.join('\n');
        console.log('>>>>> queryWithRAG > context:', context);

        // Fallback for empty context
        if (!context) {
            console.warn('No valid context retrieved from ChromaDB.');
            return 'I could not retrieve any relevant context from the database.';
        }

        // Step 3: Combine context with the user query
        const prompt = `Here is the context:\n\n${context}\n\nUser Query: ${userQuery}\n\nProvide a response based on the context.`;

        // Step 4: Send the prompt to the LLM
        const response = await sendPromptToOllama(prompt);
        console.log('>>>>> queryWithRAG > LLM response:', response);
        return response;
    } catch (error) {
        console.error('Error performing RAG query with LLM:', error);
        throw error;
    }
}

module.exports = {
    sendPromptToOllama,
    summarizeChatOllama,
    queryWithRAG,
};
