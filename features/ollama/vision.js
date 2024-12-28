const fs = require('fs');
const fetch = require('node-fetch');
const {
    ollamaHost, ollamaPort,
} = require('../../config/env_config.js');

const downloadImage = async (url, filePath) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
    return filePath;
};

const sendImageToOllama = async (imagePath, userPrompt) => {
    const response = await fetch(`http://${ollamaHost}:${ollamaPort}/api/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3.2-vision:11b',
            image: imagePath, // Provide the local file path
            prompt: userPrompt,
        }),
    });

    if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);
    const data = await response.json();
    return data.response;
};

module.exports = {
    downloadImage,
    sendImageToOllama,
};
