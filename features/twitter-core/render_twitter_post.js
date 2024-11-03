const { mkdir, readdir, readFile } = require('node:fs').promises;
const { createTwitterCanvas } = require('../twitter-post/twitter_canvas.js');
const { createTwitterVideoCanvas } = require('../twitter-video/twitter_video_canvas.js');
const { cleanup } = require('../twitter-video/cleanup.js');
const { buildPathsAndStuff } = require('../twitter-core/path_builder.js');

const { downloadVideo, bakeImageAsFilterIntoVideo } = require('../twitter-video/index.js');

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

/**
 * 
 * @param {*} message 
 */
const sendWebhookProxyMsg = async (message) => {

    console.log('>>> sendWebhookProxyMsg reached!');

    // Save user details for the webhook
    const username = message.author.username;
    console.log('>>> sendWebhookProxyMsg > username: ', username);
    const avatarURL = message.author.avatarURL({ dynamic: true }) || message.author.displayAvatarURL(); // Call displayAvatarURL as a function to get the URL
    console.log('>>> sendWebhookProxyMsg > avatarURL: ', avatarURL);
    const content = message.content; // Store the message content (Twitter link)
    console.log('>>> sendWebhookProxyMsg > content: ', content);

    // Create and use a webhook in the same channel
    const webhook = await message.channel.createWebhook({
        name: username,
        avatar: avatarURL,
    });

    console.log('>>> sendWebhookProxyMsg webhook created!');

    // Send the message through the webhook
    await webhook.send({
        content: `TESTING WEBHOOK MSG PROXY`,
        username: username,
        avatarURL: avatarURL,
    });

    console.log('>>> sendWebhookProxyMsg sent!');

    // Delete the webhook to keep the channel clean
    await webhook.delete();

    console.log('>>> sendWebhookProxyMsg deleted!');
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
        // console.error('!!! errorName: ', errorName);
        const errorMsg = err?.message;
        // console.error('!!! errorMsg: ', errorMsg);
        // console.error('!!! typeof err: ', typeof err);
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

const renderTwitterPost = async (metadataJson, message) => {
    const videoUrls = filterVideoUrls(metadataJson.mediaURLs);
    const videoUrl = videoUrls[0];
    const hasVids = videoUrls.length > 0;

    await createDirectoryIfNotExists(processingDir);

    if (hasVids) {
        const currentDirCount = await countDirectoriesInDirectory(processingDir);
        if (currentDirCount >= MAX_CONCURRENT_REQUESTS) {
            return message.reply({
                content: 'Video processing at capacity; try again later.',
            });
        }

        // build path stuff
        // const processingDir = '/tempdata';
        const pathObj = buildPathsAndStuff(processingDir, videoUrl);
        const filename = pathObj.filename;
        const localWorkingPath = pathObj.localWorkingPath;

        // paths we need to use
        const videoInputPath = `${localWorkingPath}/${filename}.mp4`;
        const canvasInputPath = `${localWorkingPath}//${filename}.png`;
        const videoOutputPath = `${localWorkingPath}/${filename}-output.mp4`;
        // console.log('>>> renderTwitterPost > videoInputPath: ', videoInputPath);
        // console.log('>>> renderTwitterPost > canvasInputPath: ', canvasInputPath);
        // console.log('>>> renderTwitterPost > videoOutputPath: ', videoOutputPath);

        // video dimensions
        const mediaObject = metadataJson.media_extended[0].size;
        if (!mediaObject.height || !mediaObject.width) {
            throw Error('Video has no dimensions in metadata! Cannot process...');
            // TODO: we would have to then infer it from the video itself possibly using ffmpeg.ffprobe
        }

        try {
            await downloadVideo(videoUrl, videoInputPath);
            const { canvasHeight, canvasWidth, heightShim } = await createTwitterVideoCanvas(metadataJson);
            const successFilePath = await bakeImageAsFilterIntoVideo(
                videoInputPath, canvasInputPath, videoOutputPath,
                mediaObject.height, mediaObject.width,
                canvasHeight, canvasWidth, heightShim,
            );
    
            /**
             * DO something with the video!!!!
             */
            // await replyMsg.delete(); // don't even need to do this anymore
            await sendVideoReply(message, successFilePath, localWorkingPath);
        } catch (err) {
            await cleanup([], [localWorkingPath]);
        }

    } else {
        // Handle non-video processing
        // console.log('>>>>> renderTwitterPost > DOES NOT have videos!!!');
        const buffer = await createTwitterCanvas(metadataJson);
        await message.suppressEmbeds(true);

        /**
         * Pull image and add it as a separate image/file
         */
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

    // await sendWebhookProxyMsg(message); // TESTING
    console.log('>>> renderTwitterPost proxy msg sent!');

};

module.exports = {
    renderTwitterPost,
};
