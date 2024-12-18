const {
  ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaModel,
} = require('../../config/env_config.js');
// Function to send a prompt to Ollama API
// async function sendPromptToOllama(prompt) {
//     const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;

//     const requestBody = {
//         model: ollamaModel, // Name of the model (e.g., "llama")
//         messages: [{ role: "user", content: prompt }] // Chat-style input
//     };

//     try {
//         const response = await fetch(url, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify(requestBody)
//         });

//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         const result = await response.json();
//         console.log(">>>>> sendPromptToOllama > Ollama Response:", result);
//         return result;
//     } catch (error) {
//         console.error(">>>>> sendPromptToOllama > Error communicating with Ollama API:", error);
//         throw error;
//     }
// }

// async function sendPromptToOllama(prompt) {
//     const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;

//     const requestBody = {
//         model: ollamaModel,
//         messages: [{ role: "user", content: prompt }]
//     };

//     try {
//         const response = await fetch(url, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify(requestBody)
//         });

//         if (!response.ok) {
//             const errorText = await response.text();
//             throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
//         }

//         const reader = response.body.getReader();
//         const decoder = new TextDecoder("utf-8");
//         let responseText = "";

//         // eslint-disable-next-line no-constant-condition
//         while (true) {
//             const { done, value } = await reader.read();
//             if (done) break;
//             responseText += decoder.decode(value, { stream: true });

//             // Process each chunk as it arrives (optional)
//             const lines = responseText.split("\n").filter(line => line.trim());
//             for (const line of lines) {
//                 try {
//                     const parsed = JSON.parse(line); // Each chunk is JSON-formatted
//                     console.log("Chunk received:", parsed.message.content);
//                 } catch (err) {
//                     console.error("Error parsing chunk:", line, err);
//                 }
//             }
//         }

//         console.log("Full response text:", responseText);
//         return responseText; // Or process final aggregated response here
//     } catch (error) {
//         console.error("Error communicating with Ollama API:", error);
//         throw error;
//     }
// }

async function sendPromptToOllama(prompt) {
    const url = `http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`;
    const requestBody = {
        model: ollamaModel,
        messages: [{ role: "user", content: prompt }]
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
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let responseText = "";
        let fullContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            responseText += decoder.decode(value, { stream: true });

            // Process each JSON line in the stream
            const lines = responseText.split("\n").filter(line => line.trim()); // Handle multiple chunks
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line); // Parse JSON chunk
                    if (parsed.message && parsed.message.content) {
                        fullContent += parsed.message.content; // Concatenate content
                    }
                } catch (err) {
                    console.error("Error parsing chunk:", line, err);
                }
            }

            // Reset responseText after processing to handle partial messages correctly
            responseText = "";
        }

        console.log("Full concatenated content:", fullContent);
        return fullContent; // Return the fully concatenated response
    } catch (error) {
        console.error("Error communicating with Ollama API:", error);
        throw error;
    }
}


module.exports = {
  sendPromptToOllama,
};


module.exports = {
    sendPromptToOllama,
};
