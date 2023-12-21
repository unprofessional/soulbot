const { createTwitterCanvas } = require('./twitter_canvas.js');

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
    renderTwitterPost,
};
