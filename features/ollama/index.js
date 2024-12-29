const {
    ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaModel,
} = require('../../config/env_config.js');

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

async function sendPromptToOllama(prompt, imagePath) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;
    const requestBody = {
        model: ollamaModel,
        ...(imagePath && { image: imagePath }), // Conditionally add 'image' property
        messages: [
            {
                role: 'system',
                content: 'Provide concise responses that do not exceed 2000 characters. ' + 
                'Avoid asking questions or prompting further interactions, as you do not retain context between requests. ' +
                'If you do not know, just say you do not know.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
        keepAlive: -1, // Keep model in memory
    };

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

module.exports = {
    sendPromptToOllama,
};
