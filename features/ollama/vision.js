const fs = require('fs');
const fetch = require('node-fetch');
// const {
//     ollamaHost, ollamaPort, ollamaChatEndpoint, ollamaModel,
// } = require('../../config/env_config.js');

const downloadImage = async (url, filePath) => {
    const res = await fetch(url);
    console.log('>>>>> vision.js > downloadImage > res: ', res);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
    return filePath;
};

// Helper function to fetch the image and convert it to Base64
const fetchImageAsBase64 = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const buffer = await response.buffer(); // Fetch image as a buffer
        return buffer.toString('base64'); // Convert buffer to Base64
    } catch (error) {
        console.error('Error converting image to Base64:', error);
        throw error;
    }
};

// const sendImageToOllama = async (imagePath, userPrompt) => {
//     const response = await fetch(`http://${ollamaHost}:${ollamaPort}/${ollamaChatEndpoint}`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//             model: ollamaModel,
//             image: imagePath, // Provide the local file path
//             prompt: userPrompt,
//             keepAlive: -1, // Keep model in memory
//         }),
//     });

//     if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);
//     const data = await response.json();
//     return data.response;
// };

module.exports = {
    downloadImage,
    fetchImageAsBase64,
    // sendImageToOllama,
};
