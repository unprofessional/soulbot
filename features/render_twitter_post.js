const { createTwitterCanvas } = require('./twitter_canvas.js');

const renderTwitterPost = async (metadataJson, message) => {
    // Convert the canvas to a Buffer
    const buffer = await createTwitterCanvas(metadataJson);

    // TODO: Pull image and add it as a separate image/file
    /**
   * stuff here
   */

    // Create a MessageAttachment and send it
    message.reply(
        {
            files: [{
                attachment: buffer,
                name: 'image.png'
            }],
            message_reference: {
                message_id: message.id,
                channel_id: message.channel.id,
                guild_id: message.guild.id
            }
        }
    );
};

module.exports = {
    renderTwitterPost,
};
