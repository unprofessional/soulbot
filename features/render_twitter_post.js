const { readFile } = require('node:fs').promises
const { createTwitterCanvas } = require('./twitter_canvas.js');
const { createTwitterVideoCanvas } = require('./twitter_video_canvas.js');
const { cleanup } = require('./video-twitter/cleanup.js');

const renderTwitterPost = async (metadataJson, message) => {

    // Calculate media
    const filteredVideoUrls = metadataJson.mediaURLs.filter((mediaUrl) => {
        const mediaUrlParts = mediaUrl.split('.');
        console.log('!!!!! mediaUrlParts: ', mediaUrlParts);
        console.log('!!!!! mediaUrlParts.length: ', mediaUrlParts.length);
        const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        console.log('!!!!! fileExtensionWithQueryParams: ', fileExtensionWithQueryParams);
        const fileExtension = fileExtensionWithQueryParams.split('?')[0];
        console.log('!!!!! fileExtension: ', fileExtension);
        return fileExtension === 'mp4';
    });
    const numOfVideos = filteredVideoUrls.length;
    console.log('>>>>> renderTwitterPost > numOfVideos: ', numOfVideos);
    const hasVids = numOfVideos > 0;
    console.log('>>>>> renderTwitterPost > hasVids: ', hasVids);

    if(hasVids) {

        /**
         * UNDER CONSTRUCTION
         */
        // await message.reply(
        //     {
        //         content: 'Video generation is under construction!',
        //     }
        // );

        const mediaUrl = metadataJson.mediaURLs[0];

        await message.reply(
            {
                content: mediaUrl,
            }
        );

        return;
        
        // console.log('>>>>> renderTwitterPost > HAS videos!!!');
        // const mediaUrl = metadataJson.mediaURLs[0];
        // const mediaUrlParts = mediaUrl.split('/');
        // const filenameWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        // const filenameWithQueryParamsParts = filenameWithQueryParams.split('?');
        // const originalVideoFilename = filenameWithQueryParamsParts[0];
        // console.log('>>>>> renderTwitterPost > originalVideoFilename: ', originalVideoFilename);
        // const finalVideoFilename = `recombined-av-${originalVideoFilename}`;
        // console.log('>>>>> renderTwitterPost > finalVideoFilename: ', finalVideoFilename);
        // const finalVideoFilePath = `ffmpeg/${finalVideoFilename}`;

        // await message.reply(
        //     {
        //         content: 'Generating video! Could take a minute. Please stand by...',
        //     }
        // );

        // await createTwitterVideoCanvas(metadataJson);

        // // Create a MessageAttachment and send it
        // try {
        //     const files = [];
        //     const finalVideoFile = await readFile(finalVideoFilePath);
        //     files.push({
        //         attachment: finalVideoFile,
        //         name: 'video.mp4', // FIXME: Use the actual file hash + extension etc
        //     });

        //     await message.reply(
        //         {
        //             // content: `Media URLs found: ${mediaUrlsFormatted}`,
        //             files,
        //         }
        //     );
        // } catch (err) {
        //     await message.reply(
        //         {
        //             content: `Video was too large to attach! err: ${err}`,
        //         }
        //     );
        // }

        // await cleanup([finalVideoFilePath], ['ffmpeg', 'ffmpeg/canvassed']);
    }
    else {
        console.log('>>>>> renderTwitterPost > DOES NOT have videos!!!');
        // Convert the canvas to a Buffer
        const buffer = await createTwitterCanvas(metadataJson);
        await message.suppressEmbeds(true);

        /**
         * Pull image and add it as a separate image/file
         */
        console.log('>>>>> renderTwitterPost > metadataJson: ', metadataJson);
        const mediaUrls = metadataJson.mediaURLs;
        console.log('>>>>> renderTwitterPost > mediaUrls: ', mediaUrls);

        let files = [{
            attachment: buffer,
            name: 'image.png',
        }];

        // Create a MessageAttachment and send it
        try {
            await message.reply(
                {
                    files,
                }
            );
        } catch (err) {
            await message.reply(
                {
                    content: `File(s) too large to attach! err: ${err}`,
                }
            );
        }
    }
};

module.exports = {
    renderTwitterPost,
};
