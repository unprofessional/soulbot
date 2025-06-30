// features/twitter-core/render_twitter_post.js

const { mkdir, readdir, readFile } = require('node:fs').promises;
const { createTwitterCanvas } = require('../twitter-post/twitter_canvas.js');
const { createTwitterVideoCanvas } = require('../twitter-video/twitter_video_canvas.js');
const { cleanup } = require('../twitter-video/cleanup.js');
const { buildPathsAndStuff } = require('../twitter-core/path_builder.js');

const { downloadVideo, getVideoFileSize, bakeImageAsFilterIntoVideo } = require('../twitter-video/index.js');
const { getExtensionFromMediaUrl, stripQueryParams, randomNameGenerator } = require('./utils.js');
const { embedCommunityNote } = require('./canvas_utils.js');
// FIXME: 
// const { client } = require('../../initial_client.js');

const MAX_CONCURRENT_REQUESTS = 3;
const processingDir = '/tempdata';

/**
 * PLACE ALL OF THESE UTIL FNS IN SEPARATE FILE???
 */

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

const trimQueryParamsFromTwitXUrl = (content) => {
    console.log('>>> trimQueryParamsFromTwitXUrl webhook reached!');

    const twitterOrXUrlWithQueryParamPattern = /https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+(?:\?.*)?/g;

    // const twitterOrXUrlPattern = /https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+/g;

    const urlWithQueryParams = content.match(twitterOrXUrlWithQueryParamPattern);
    // console.log('>>> trimQueryParamsFromTwitXUrl > urlWithQueryParams: ', urlWithQueryParams);
    const strippedUrl = stripQueryParams(urlWithQueryParams[0]);
    // console.log('>>> trimQueryParamsFromTwitXUrl > strippedUrl: ', strippedUrl);

    const urlTrimmedContent = content.replace(twitterOrXUrlWithQueryParamPattern, strippedUrl);
    // console.log('>>> trimQueryParamsFromTwitXUrl > urlTrimmedContent: ', urlTrimmedContent);

    return urlTrimmedContent.replace(/(https:\/\/\S+)/, '<$1>');
    // console.log('>>> trimQueryParamsFromTwitXUrl > modifiedContent: ', modifiedContent);
};

const webhookBuilder = async (parentChannel, message, displayName, avatarURL) => {
    const webhook = await parentChannel.createWebhook({
        name: displayName,
        avatar: avatarURL,
    });
    
    let threadId;
    
    // If the message started a thread
    if (message.hasThread && message.thread) {
        threadId = message.thread.id;
        // console.log(`>>> sendWebhookProxyMsg > Message starts a new thread: ${threadId}`);
    }
    
    // If the message was sent inside an existing thread
    else if (message.channel.isThread()) {
        threadId = message.channel.id;
        // console.log(`>>> sendWebhookProxyMsg > Message sent within existing thread: ${threadId}`);
    }
    return { webhook, threadId };
};

/**
 * THE REAL MEAT OF THIS FILE'S PURPOSE BEGINS HERE
 */

const sendWebhookProxyMsg = async (message, content, files = [], communityNoteText, originalLink) => {
    // console.log('>>>>> sendWebhookProxyMsg > originalLink: ', originalLink);
    try {
        // Use parent channel for webhook creation and management
        const parentChannel = message.channel.isThread() ? message.channel.parent : message.channel;
        const webhooks = await parentChannel.fetchWebhooks();

        // Delete all existing webhooks created by the bot in this channel
        const botWebhooks = webhooks.filter(wh => wh.owner.id === message.client.user.id);
        // console.log(`>>> Deleting ${botWebhooks.size} existing webhooks`);

        for (const webhook of botWebhooks.values()) {
            await webhook.delete().catch(err => console.warn(`Failed to delete webhook: ${err}`));
        }

        const embed = embedCommunityNote(message, communityNoteText);
        const nickname = message.member?.nickname;
        const displayName = nickname || message.author.globalName || message.author.username;
        // console.log('>>> sendWebhookProxyMsg > displayName: ', displayName);

        const avatarURL = message.author.avatarURL({ dynamic: true }) || message.author.displayAvatarURL();
        // console.log('>>> sendWebhookProxyMsg > avatarURL: ', avatarURL);
        // console.log('>>> sendWebhookProxyMsg > content: ', content);

        const { webhook, threadId } = await webhookBuilder(parentChannel, message, displayName, avatarURL);

        const modifiedContent = trimQueryParamsFromTwitXUrl(message.content);
        // console.log('>>> sendWebhookProxyMsg > modifiedContent: ', modifiedContent);

        // Send the message through the webhook
        await webhook.send({
            content: modifiedContent,
            ...(embed && { embeds: [embed] }),
            ...(threadId && { threadId }),
            username: displayName,
            avatarURL: avatarURL,
            files: files,
        });

        // console.log('>>> sendWebhookProxyMsg sent!');

        // Delete the USER MESSAGE to reduce channel clutter
        await message.delete();
        // console.log('>>> sendWebhookProxyMsg message deleted!');

        // Delete the WEBHOOK to prevent accumulation
        await webhook.delete();
        // console.log('>>> sendWebhookProxyMsg webhook deleted!');
    } catch (error) {
        console.error('>>> sendWebhookProxyMsg error: ', error);
        // console.error('>>> sendWebhookProxyMsg typeof error: ', typeof error);
        const tooLargeErrorStr = 'DiscordAPIError[40005]: Request entity too large';
        if(error.name === 'DiscordAPIError[40005]') {
            console.log('!!!!!! DiscordAPIError[40005] CAUGHT!!!!!!');
            // message.reply(`${tooLargeErrorStr}: video file size was likely too large for this server's tier...`);

            const fixuptLink = originalLink.replace('https://x.com', 'https://fixupx.com');

            message.reply(`${tooLargeErrorStr}: video file size was likely too large for this server's tier... defaulting to FIXUPX link: ${fixuptLink}`);
        }
    }
};


const sendVideoReply = async (message, successFilePath, localWorkingPath, originalLink) => {
    // console.log('>>> sendVideoReply > originalLink: ', originalLink);
    const files = [{
        attachment: await readFile(successFilePath),
        name: 'video.mp4',
    }];

    try {
        // await message.reply({ files });

        try {
            console.log('>>> sendVideoReply > TRYING WEBHOOK...');
            await sendWebhookProxyMsg(message, 'Here’s the Twitter canvas:', files, undefined, originalLink);
        } catch (err) {
            console.log('>>> sendVideoReply > WEBHOOK FAILED!!!');
            await sendWebhookProxyMsg(message, `File(s) too large to attach! err: ${err}`, undefined, undefined, originalLink);
        }


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

const renderTwitterPost = async (metadataJson, message, originalLink) => {
    console.log('>>>>> renderTwitterPost > originalLink: ', originalLink);
    const videoUrls = filterVideoUrls(metadataJson.mediaURLs);
    const videoUrl = videoUrls[0];
    const hasVids = videoUrls.length > 0;
    const communityNoteText = metadataJson.communityNote;

    await createDirectoryIfNotExists(processingDir);

    // is first item in list a video?
    let firstMediaItem, firstMediaItemExt;
    if(metadataJson.mediaURLs.length > 0) {
        firstMediaItem = metadataJson?.media_extended[0];
        firstMediaItemExt = getExtensionFromMediaUrl(firstMediaItem?.url);
    }
    console.log('>>>>> renderTwitterPost > firstMediaItem: ', firstMediaItem);
    console.log('>>>>> renderTwitterPost > firstMediaItemExt: ', firstMediaItemExt);

    // FIXME: redundant.... if firstMediaItemExt is indeed mp4 then of course it hasVids
    if (hasVids && firstMediaItemExt === 'mp4') {
        console.log('>>>>> renderTwitterPost > first item is VIDEO');
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


            /**
             * UNCOMMENT WHEN READY
             */
            const fileSize = await getVideoFileSize(videoInputPath);
            console.log('>>> TODO: renderTwitterPost > fileSize: ', fileSize);
            const guildId = message.guildId;
            console.log('>>> TODO: renderTwitterPost > guildId: ', guildId);
            const guild = message.client.guilds.cache.get(guildId);
            const boostTier = guild.premiumTier;
            console.log('>>> TODO: renderTwitterPost > boostTier: ', boostTier);
            /**
             * UNCOMMENT WHEN READY
             */

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
            await sendVideoReply(message, successFilePath, localWorkingPath, originalLink);
        } catch (err) {
            console.error('>>> ERROR: renderTwitterPost > err: ', err);
            await cleanup([], [localWorkingPath]);
        }

    } else {
        // Handle non-video processing
        console.log('>>>>> renderTwitterPost > first item is NOT VIDEO');
        const buffer = await createTwitterCanvas(metadataJson);
        await message.suppressEmbeds(true);

        const randomName = randomNameGenerator();

        /**
         * Pull image and add it as a separate image/file
         */
        let files = [{
            attachment: buffer,
            name: `${randomName}.png`,
        }];

        // Use the webhook proxy to send the message with the file
        try {
            console.log('>>> renderTwitterPost > TRYING WEBHOOK...');
            await sendWebhookProxyMsg(message, 'Here’s the Twitter canvas:', files, communityNoteText, originalLink);
        } catch (err) {
            console.log('>>> renderTwitterPost > WEBHOOK FAILED!!!');
            await sendWebhookProxyMsg(message, `File(s) too large to attach! err: ${err}`, undefined, undefined, originalLink);
        }
    }

    console.log('>>> renderTwitterPost proxy msg sent!');

};

module.exports = {
    renderTwitterPost,
};
