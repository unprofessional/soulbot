const { unfurl } = require('unfurl.js');
const { createTwitterCanvas } = require('./twitter_canvas.js');

const fetchMetadata = async (url, message) => {
    const metadata = await unfurl(url);
    //     message.channel.send(`
    // \`\`\`JSON
    // ${JSON.stringify(metadata, null, 2)}
    // \`\`\``);
    return metadata;
};

const renderTwitterPost = async (metadataJson, message) => {
    // Convert the canvas to a Buffer
    const buffer = await createTwitterCanvas(metadataJson);

    // TODO: Pull image and add it as a separate image/file
    /**
     * stuff here
     */

    // Create a MessageAttachment and send it
    message.channel.send({
        files: [{
            attachment: buffer,
            name: 'image.png'
        }]
    });
};

module.exports = {
    fetchMetadata,
    renderTwitterPost,
};
