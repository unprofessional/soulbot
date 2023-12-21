const { createTwitterCanvas } = require('./twitter_canvas.js');

const renderTwitterPost = async (metadataJson, message) => {
    // Convert the canvas to a Buffer
    const buffer = await createTwitterCanvas(metadataJson);

    /**
     * Pull image and add it as a separate image/file
     */
    console.log('>>>>> renderTwitterPost > metadataJson: ', metadataJson);
    const mediaUrls = metadataJson.mediaURLs;
    console.log('>>>>> renderTwitterPost > mediaUrls: ', mediaUrls);
    let mediaUrlsFormatted = "";
    let files = [{
      attachment: buffer,
      name: 'image.png',
    }];
    mediaUrls.forEach((mediaUrl) => {
      mediaUrlsFormatted += `${mediaUrl}\n` // TODO: fix singular dangling comma
      files.push({
        attachment: mediaUrl,
        name: 'image.png', // FIXME: Use the actual file hash + extension etc
      });
    });

    // Create a MessageAttachment and send it
    message.reply(
        {
            // content: `Media URLs found: ${mediaUrlsFormatted}`,
            files,
        }
    );
};

module.exports = {
    renderTwitterPost,
};
