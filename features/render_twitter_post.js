const { createTwitterCanvas } = require('./twitter_canvas.js');

const renderTwitterPost = async (metadataJson, message) => {
    // Convert the canvas to a Buffer
    const buffer = await createTwitterCanvas(metadataJson);

    /**
     * Pull image and add it as a separate image/file
     */
    console.log('>>>>> renderTwitterPost > metadataJson: ', metadataJson);
    const mediaUrls = metadataJson.mediaUrls;
    console.log('>>>>> renderTwitterPost > mediaUrls: ', mediaUrls);
    let mediaUrlsFormatted = "";
    mediaUrls.forEach((mediaUrl) => {
      mediaUrlsFormatted += `\`${mediaUrl}\`, ` // TODO: fix singular dangling comma
    });

    // Create a MessageAttachment and send it
    message.reply(
        {
            content: `Media URLs found: ${mediaUrlsFormatted}`,
            files: [{
                attachment: buffer,
                name: 'image.png'
            }],
        }
    );
};

module.exports = {
    renderTwitterPost,
};
