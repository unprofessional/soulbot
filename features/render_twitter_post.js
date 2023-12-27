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
    // let mediaUrlsFormatted = "";
    let files = [{
        attachment: buffer,
        name: 'image.png',
    }];

    const filteredVideoUrls = metadataJson.mediaURLs.filter((mediaUrl) => {
        const mediaUrlParts = mediaUrl.split('.');
        // console.log('!!!!! mediaUrlParts: ', mediaUrlParts);
        // console.log('!!!!! mediaUrlParts.length: ', mediaUrlParts.length);
        const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        // console.log('!!!!! fileExtensionWithQueryParams: ', fileExtensionWithQueryParams);
        const fileExtension = fileExtensionWithQueryParams.split('?')[0];
        // console.log('!!!!! fileExtension: ', fileExtension);
        return fileExtension === 'mp4'
    });
    const numOfVideos = filteredVideoUrls.length;
    const hasVids = numOfVideos > 0;

    if(hasVids) {
        mediaUrls.forEach((mediaUrl) => {
            // mediaUrlsFormatted += `${mediaUrl}\n` // TODO: fix singular dangling comma
            files.push({
                attachment: mediaUrl,
                name: 'video.mp4', // FIXME: Use the actual file hash + extension etc
            });
        });
    } else {
        // Create a MessageAttachment and send it
        message.reply(
            {
                // content: `Media URLs found: ${mediaUrlsFormatted}`,
                files,
            }
        );
    }
};

module.exports = {
    renderTwitterPost,
};
