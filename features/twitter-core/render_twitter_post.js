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

/**
 * !!! DEPRECATED !!!
 * @param {d} metadataJson 
 * @param {*} message 
 * @param {*} isTwitterUrl 
 * @returns 
 */
const oldRenderTwitterPost = async (metadataJson, message, isTwitterUrl) => {

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

    console.log('>>>>> renderTwitterPost > creating directories if not exists...');
    await createDirectoryIfNotExists(processingDir);

    if(hasVids) {

        const currentDirCount = await countDirectoriesInDirectory(processingDir);
        if (currentDirCount >= MAX_CONCURRENT_REQUESTS) {
            // Logic to queue the request or reject it with a message to try again later
            return await message.reply(
                {
                    content: 'Video processing at capacity; try again later.',
                }
            );
        }
        
        console.log('>>>>> renderTwitterPost > HAS videos!!!');

        const mediaUrl = metadataJson.mediaURLs[0];
        const mediaUrlParts = mediaUrl.split('/');
        const filenameWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        const filenameWithQueryParamsParts = filenameWithQueryParams.split('?');
        const originalVideoFilename = filenameWithQueryParamsParts[0];
        // console.log('>>>>> renderTwitterPost > originalVideoFilename: ', originalVideoFilename);
        // const finalVideoFilename = `recombined-av-${originalVideoFilename}`;
        // console.log('>>>>> renderTwitterPost > finalVideoFilename: ', finalVideoFilename);
        // const finalVideoFilePath = `ffmpeg/${finalVideoFilename}`;

        const filenameParts = originalVideoFilename.split('.');
        const filename = filenameParts[0]; // grab filename/fileID without extension
        const localWorkingPath = `${processingDir}/${filename}`; // filename is the directory here for uniqueness
        // const localVideoOutputPath = `${localWorkingPath}/${originalVideoFilename}`;
        // const localCompiledVideoOutputPath = `${localWorkingPath}/finished-${originalVideoFilename}`;
        // const recombinedFilePath = `${localWorkingPath}/recombined-av-${originalVideoFilename}`;

        await message.reply(
            {
                content: 'Generating video! Could take a minute. Please stand by...',
            }
        );

        const successFilePath = await createTwitterVideoCanvas(metadataJson); // possible to get either audio or no audio version
        console.log('>>>>> renderTwitterPost > successFilePath: ', successFilePath);

        // Create a MessageAttachment and send it
        try {
            if (successFilePath === false) {
                const twitterUrl = metadataJson.tweetURL;
                const fixedUrl = isTwitterUrl
                    ? twitterUrl.replace('https://twitter.com', 'https://vxtwitter.com') 
                    : twitterUrl.replace('https://x.com', 'https://fixvx.com');
                await message.reply(
                    {
                        content: `Video too long! Must be less than 60 seconds! ${fixedUrl}`,
                    }
                );
                await cleanup([], [localWorkingPath]);
            }
            else {
                const files = [];
                const finalVideoFile = await readFile(successFilePath);
                files.push({
                    attachment: finalVideoFile,
                    name: 'video.mp4', // FIXME: Use the actual file hash + extension etc
                });
    
                await message.reply(
                    {
                        // content: `Media URLs found: ${mediaUrlsFormatted}`,
                        files,
                    }
                );
            }
        } catch (err) {
            console.err('!!! err2: ', err2);
            const messageReference = err2.message_reference;
            console.err('!!! messageReference: ', messageReference);
            const unknownMessage = messageReference.REPLIES_UNKNOWN_MESSAGE;
            console.err('!!! unknownMessage: ', unknownMessage);
            await cleanup([], [localWorkingPath]);
            // if () {

            // }
            // await message.reply(
            //     {
            //         content: `Video was too large to attach! err: ${err}`,
            //     }
            // );
        }

        await cleanup([], [localWorkingPath]);
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

    await message.reply({
        content: 'Generating video! Could take a minute. Please stand by...',
    });

    const successFilePath = await createTwitterVideoCanvas(metadataJson);

    if (!successFilePath) {
        return handleVideoTooLong(metadataJson, message, isTwitterUrl, localWorkingPath);
    }

    await sendVideoReply(message, successFilePath, localWorkingPath);
};


const handleVideoTooLong = async (metadataJson, message, isTwitterUrl, localWorkingPath) => {
    console.log('Video too long');
    const twitterUrl = metadataJson.tweetURL;
    const fixedUrl = isTwitterUrl
        ? twitterUrl.replace('https://twitter.com', 'https://vxtwitter.com') 
        : twitterUrl.replace('https://x.com', 'https://fixvx.com');

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
        await message.reply({
            content: `Video was too large to attach! err: ${err}`,
        });
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
    oldRenderTwitterPost,
    renderTwitterPost,
};
