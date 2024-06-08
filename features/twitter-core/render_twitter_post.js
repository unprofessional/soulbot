const { mkdir, readdir, readFile } = require('node:fs').promises
const { createTwitterCanvas } = require('../twitter-post/twitter_canvas.js');
const { createTwitterVideoCanvas } = require('../twitter-video/twitter_video_canvas.js');
// const { getVideoDuration } = require('./video-twitter');
const { cleanup } = require('../twitter-video/cleanup.js');

const MAX_CONCURRENT_REQUESTS = 3;
const processingDir = '/tempdata';

async function createDirectoryIfNotExists(processingDir) {
    try {
        await mkdir(`./${processingDir}/`, { recursive: true });
        console.log(`Directory ${processingDir} created or already exists`);
    } catch (err) {
        console.error(`Error creating directory ${processingDir}:`, err);
        throw err;
    }
}

async function countDirectoriesInDirectory(dirPath) {
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const dirCount = entries.filter(dirent => dirent.isDirectory()).length;
        return dirCount;
    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    }
}

const filterVideoUrls = (mediaUrls) => {
    return mediaUrls.filter(url => {
        const fileExtension = url.split('.').pop().split('?')[0];
        console.log('File extension:', fileExtension);
        return fileExtension === 'mp4';
    });
};

const getFilenameWithoutExtension = (url) => {
    const filenameWithQueryParams = url.split('/').pop();
    return filenameWithQueryParams.split('?')[0].split('.')[0];
};

const processVideos = async (metadataJson, message, isTwitterUrl) => {
    console.log('Processing videos');

    const mediaUrl = metadataJson.mediaURLs[0];
    const filename = getFilenameWithoutExtension(mediaUrl);
    const localWorkingPath = `${processingDir}/${filename}`;

    const replyMsg = await message.reply({
        content: 'Generating video! Could take a minute. Please stand by...',
    });
    console.log('>>>>> renderTwitterPost > replyMsg: ', replyMsg);

    const successFilePath = await createTwitterVideoCanvas(metadataJson);

    if (!successFilePath) {
        await replyMsg.delete();
        return handleVideoTooLong(metadataJson, message, isTwitterUrl, localWorkingPath);
    }

    await replyMsg.delete();
    await sendVideoReply(message, successFilePath, localWorkingPath);
};


const handleVideoTooLong = async (metadataJson, message, isTwitterUrl, localWorkingPath) => {
    console.log('Video too long');
    const twitterUrl = metadataJson.tweetURL;
    // NOTE: for now, it looks like this will ALWAYS be a twitter.com URL
    // const fixedUrl = isTwitterUrl
    //     ? twitterUrl.replace('https://twitter.com', 'https://vxtwitter.com') 
    //     : twitterUrl.replace('https://x.com', 'https://fixvx.com');
    const fixedUrl = twitterUrl.replace('https://twitter.com', 'https://vxtwitter.com');

    await message.reply({
        content: `Video too long! Must be less than 60 seconds! ${fixedUrl}`,
    });

    await cleanup([], [localWorkingPath]);
};

const sendVideoReply = async (message, successFilePath, localWorkingPath) => {
    console.log('Sending video reply');
    const files = [{
        attachment: await readFile(successFilePath),
        name: 'video.mp4',
    }];

    try {
        await message.reply({ files });
    } catch (err) {
        console.error('!!! err: ', err);
        const errorName = err?.name;
        console.error('!!! errorName: ', errorName);
        const errorMsg = err?.message;
        console.error('!!! errorMsg: ', errorMsg);
        console.error('!!! typeof err: ', typeof err);
        // const unknownMessage = messageReference?.REPLIES_UNKNOWN_MESSAGE;
        // console.error('!!! unknownMessage: ', unknownMessage);
        await cleanup([], [localWorkingPath]);
        if (errorMsg === 'Invalid Form Body' || errorName === 'DiscordAPIError[50035]') {
            console.log('>>> errorMsg is Invalid Form Body');
            await message.channel.send(
                {
                    content: `Encountered error trying to reply... the sender probably deleted the original message: ${err}`,
                }
            );
        }
        await message.channel.send(
            {
                content: `There was a problem! err: ${err}`,
            }
        );
    }

    await cleanup([], [localWorkingPath]);
};

const renderTwitterPost = async (metadataJson, message, isTwitterUrl) => {
    const videoUrls = filterVideoUrls(metadataJson.mediaURLs);
    const hasVids = videoUrls.length > 0;

    await createDirectoryIfNotExists(processingDir);

    if (hasVids) {
        const currentDirCount = await countDirectoriesInDirectory(processingDir);
        if (currentDirCount >= MAX_CONCURRENT_REQUESTS) {
            return message.reply({
                content: 'Video processing at capacity; try again later.',
            });
        }

        return processVideos(metadataJson, message, isTwitterUrl);
    } else {
        // Handle non-video processing
        console.log('>>>>> renderTwitterPost > DOES NOT have videos!!!');
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
