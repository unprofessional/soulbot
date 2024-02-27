const { readFile } = require('node:fs').promises
const { createTwitterCanvas } = require('./twitter_canvas.js');
const { createTwitterVideoCanvas } = require('./twitter_video_canvas.js');
const { cleanup } = require('./video-twitter/cleanup.js');

const renderTwitterPost = async (metadataJson, message) => {

    const mediaUrl = metadataJson.mediaURLs[0];
    const mediaUrlParts = mediaUrl.split('/');
    const filenameWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
    const filenameWithQueryParamsParts = filenameWithQueryParams.split('?');
    const originalVideoFilename = filenameWithQueryParamsParts[0];
    console.log('>>>>> renderTwitterPost > originalVideoFilename: ', originalVideoFilename);
    const finalVideoFilename = `recombined-av-${originalVideoFilename}`;
    console.log('>>>>> renderTwitterPost > finalVideoFilename: ', finalVideoFilename);
    const finalVideoFilePath = `ffmpeg/${finalVideoFilename}`;
    
    // Calculate media
    const filteredVideoUrls = metadataJson.mediaURLs.filter((mediaUrl) => {
        const mediaUrlParts = mediaUrl.split('.');
        // console.log('!!!!! mediaUrlParts: ', mediaUrlParts);
        // console.log('!!!!! mediaUrlParts.length: ', mediaUrlParts.length);
        const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        // console.log('!!!!! fileExtensionWithQueryParams: ', fileExtensionWithQueryParams);
        const fileExtension = fileExtensionWithQueryParams.split('?')[0];
        // console.log('!!!!! fileExtension: ', fileExtension);
        return fileExtension === 'mp4';
    });
    const numOfVideos = filteredVideoUrls.length;
    const hasVids = numOfVideos > 0;

    if(hasVids) {
        await createTwitterVideoCanvas(metadataJson);

        // Create a MessageAttachment and send it
        try {
            const files = [];
            const finalVideoFile = await readFile(finalVideoFilePath);
            files.push(finalVideoFile);

            await message.reply(
                {
                    // content: `Media URLs found: ${mediaUrlsFormatted}`,
                    files,
                }
            );
        } catch (err) {
            await message.reply(
                {
                    content: `Video was too large to attach! err: ${err}`,
                }
            );
        }

        await cleanup([finalVideoFilePath], ['ffmpeg', 'ffmpeg/canvassed']);
    }
    else {
        // Convert the canvas to a Buffer
        const buffer = await createTwitterCanvas(metadataJson);
        await message.suppressEmbeds(true);

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
    }
};

module.exports = {
    renderTwitterPost,
};
