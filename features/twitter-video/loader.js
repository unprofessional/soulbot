const {
    constants,
    writeFile,
} = require('node:fs').promises;
const {
    createReadStream,
    createWriteStream,
} = require('node:fs');

// https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
var ffmpeg = require('fluent-ffmpeg');

/**
 * 1) Fetch video and save it locally
 * 2) Use ffmpeg to loop through each 1-sec frame
 * 3) save each frame as a .png
 */

const basePath = process.env.STORE_PATH;

/**
 * 
 * @param {*} remoteFileUrl 
 * @param {*} outputPath 
 * @returns 
 */
const downloadVideo = async (remoteFileUrl, outputPath) => {
    const response = await fetch(remoteFileUrl);
    const fileStream = createWriteStream(outputPath);
    response.body.pipe(fileStream);
    return new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
    });
};

/**
 * 
 * @param {*} localFilePath 
 */
const processVideo = (localFilePath) => {
    const outputPath = `${basePath}/${localFilePath}.mp4`;
    ffmpeg(localFilePath)
        .output(outputPath)
        .on('end', () => console.log('Processing finished.'))
        .on('error', (err) => console.error('Processing error:', err))
        .run();
};
