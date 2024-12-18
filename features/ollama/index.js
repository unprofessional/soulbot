const {
  ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaModel,
} = require('../../config/env_config.js');
// Function to send a prompt to Ollama API
async function sendPromptToOllama(prompt) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;

    const requestBody = {
        model: ollamaModel, // Name of the model (e.g., "llama")
        messages: [{ role: "user", content: prompt }] // Chat-style input
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Ollama Response:", result);
        return result;
    } catch (error) {
        console.error("Error communicating with Ollama API:", error);
        throw error;
    }
}

module.exports = {
    sendPromptToOllama,
};
