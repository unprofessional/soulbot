const fs = require('fs');
const fetch = require('node-fetch');

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

module.exports = {
    downloadImage,
    fetchImageAsBase64,
    // sendImageToOllama,
};
