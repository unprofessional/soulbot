const { existsSync } = require('node:fs');
const { 
    mkdir,
    // readFile,
    readdir,
    stat,
    writeFile,
} = require('node:fs').promises
const {
    // registerFont,
    createCanvas,
    loadImage,
} = require('canvas');
// const { cropSingleImage } = require('./crop_single_image.js');
const { singleVideoFrame } = require('./image_gallery_rendering.js');
const { 
    downloadVideo,
    extractAudioFromVideo,
    extractFrames,
    recombineFramesToVideo,
    combineAudioWithVideo,
} = require('./video-twitter');
const { buildPathsAndStuff } = require('./path_builder.js');
const TimeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

function getWrappedText(ctx, text, maxWidth, hasVids) {
    const lines = [];
    const paragraphs = hasVids
        ? [text.replace(/\n/g, ' ')]
        : text.split('\n'); // Conditionally handle newlines

    paragraphs.forEach(paragraph => {
        const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/;
        const containsUrl = shortTwitterUrlPattern.test(paragraph);
        const matches = paragraph.split(shortTwitterUrlPattern);

        if(containsUrl && matches[0]) {
            paragraph = matches[0];
        }

        if (paragraph === '') {
            lines.push(''); // Handle blank lines (paragraph breaks)
        } else {
            const words = paragraph.split(' ');
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                // console.log('!!!!! getWrappedText > width: ', width);
                // console.log('!!!!! getWrappedText > maxWidth: ', maxWidth);
            
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine); // Push the last line of the paragraph
        }
    });
    return lines;
}

const formatTwitterDate = (twitterDate) => {
    // Parse the date string and create a Date object
    const date = new Date(twitterDate);
    return timeAgo.format(date); 
};

const createTwitterVideoCanvas = async (metadataJson) => {
    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: metadataJson.text || "",
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
    };
    console.log('>>>>> createTwitterVideoCanvas > metadata: ', metadata);

    const globalFont = 'Arial';
    const maxCanvasWidth = 600;
    let canvasHeight = 650;
    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    const numOfImgs = 1;//filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    console.log('>>>>> createTwitterCanvas > numOfImgs', numOfImgs);
    const numOfVideos = 1;//filterMediaUrls(metadata, ['mp4']).length;
    console.log('>>>>> createTwitterCanvas > numOfVideos', numOfVideos);
    let mediaMaxHeight = 600;//getMaxHeight(numOfImgs);
    let mediaMaxWidth = 560;
    const hasImgs = numOfImgs > 0;
    const hasVids = numOfVideos > 0;
    const hasOnlyVideos = numOfVideos > 0 && !hasImgs;

    // Default media embed dimensions
    let mediaObject = {
        height: 0,
        width: 0,
    };

    let heightShim = 0;

    if(hasImgs) {
        // console.log('>>>>> has images!');
        mediaObject = {
            height: metadata.mediaExtended[0].size.height,
            width: metadata.mediaExtended[0].size.width,
        };
        // console.log('>>>>> hasImgs > mediaObject: ', mediaObject);
        if(metadata.mediaExtended.length < 2 && mediaObject.width > mediaObject.height) {
            const newWidthRatio = mediaMaxWidth / mediaObject.width;
            // console.log('>>>>> newWidthRatio: ', newWidthRatio);
            const adjustedHeight = mediaObject.height * newWidthRatio;
            // console.log('>>>>> adjustedHeight: ', adjustedHeight);
            heightShim = adjustedHeight;    
        } else {
            heightShim = mediaMaxHeight;
        }
    }

    // Pre-process description with text wrapping
    const maxCharLength = hasOnlyVideos ? 120 : 220; // Maximum width for text
    const descLines = getWrappedText(ctx, metadata.description, maxCharLength, hasOnlyVideos);
    let defaultYPosition = 110; // Starting Y position for description text

    // New height calcs
    const descLinesLength = descLines.length;
    const calculatedCanvasHeightFromDescLines = hasVids && !hasImgs
        ? maxCanvasWidth // Has vids, make square
        : (descLinesLength * 30) + defaultYPosition + 40 + heightShim;

    console.log('>>>>> calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);

    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines;
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines);

    const drawBasicElements = (metadata, favicon, pfp) => {
        // Load and draw favicon
        ctx.drawImage(favicon, 550, 20, 32, 32);

        // Draw nickname elements
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px ' + globalFont;
        ctx.fillText(metadata.authorUsername, 100, 40);

        // Draw username elements
        ctx.fillStyle = 'gray';
        ctx.font = '18px ' + globalFont;
        ctx.fillText(`@${metadata.authorNick}`, 100, 60);
  
        // Draw description (post text wrap handling)
        ctx.fillStyle = 'white';
        ctx.font = !hasImgs && hasVids ? '36px ' + globalFont : '24px ' + globalFont;
        const lineHeight = hasOnlyVideos ? 50 : 30;
        const descXPosition = !hasImgs && hasVids ? 80 : 30;
        descLines.forEach(line => {
            ctx.fillText(line, descXPosition, defaultYPosition);
            defaultYPosition += lineHeight;
        });

        // Draw date elements
        ctx.fillStyle = 'gray';
        ctx.font = '18px ' + globalFont;
        ctx.fillText(`${formatTwitterDate(metadata.date)} from this posting`, 30, calculatedCanvasHeightFromDescLines - 20);
  
        // Draw pfp image
        ctx.drawImage(pfp, 20, 20, 50, 50);
    };
  
    const favIconUrl = 'https://abs.twimg.com/favicons/twitter.3.ico';
    const favicon = await loadImage(favIconUrl);
    const pfpUrl = metadata.pfpUrl;
    const pfp = await loadImage(pfpUrl);
    drawBasicElements(metadata, favicon, pfp);

    // TODO: Utility function
    const videoUrl = metadata.mediaUrls[0];
    console.log('>>>>> twitter_video_canvas > videoUrl: ', videoUrl);

    /**
     * BEGIN FILENAME / PATHING PRE-PROCESSING
     * 
     * TODO: Refactor ths out into a utility function that returns an object with these properties (and better named)
     */
    const processingDir = '/tempdata';
    const workingDir = 'canvassed';
    const pathObj = buildPathsAndStuff(processingDir, videoUrl);

    const localWorkingPath = pathObj.localWorkingPath;
    const localVideoOutputPath = pathObj.localVideoOutputPath;
    const localAudioPath = pathObj.localAudioPath;
    const framesPattern = pathObj.framesPattern;
    const localCompiledVideoOutputPath = pathObj.localCompiledVideoOutputPath;
    const recombinedFilePath = pathObj.recombinedFilePath;

    console.log('>>>>> twitter_video_canvas > downloading video...');
    const isSuccess = await downloadVideo(videoUrl, localVideoOutputPath);
    console.log('>>>>> twitter_video_canvas > isSuccess: ', isSuccess);
    if (isSuccess === false) { // duration too long FIXME: we need to capture this specific Error scenario (custom Error Object?)
        return false;
    }

    try {
        console.log('>>>>> twitter_video_canvas > extracting audio...');
        await extractAudioFromVideo(localVideoOutputPath, localAudioPath);
    } catch (err) {
        console.log('>>>>> twitter_video_canvas > audio processing error!: ', err);
    }
    console.log('>>>>> twitter_video_canvas > extracting video frames...');
    await extractFrames(localVideoOutputPath);

    console.log('>>>>> twitter_video_canvas > compiling list of frames to work with...');
    const framesFilenamesUnfiltered = await readdir(localWorkingPath); // raw video frames, not yet canvassed
    const framesFilenames = framesFilenamesUnfiltered.filter((framepath) => {
        const framepathParts = framepath.split('.');
        return framepathParts[framepathParts.length - 1] === 'png';
    });

    // console.log('>>>>> twitter_video_canvas > framesFilenames: ', framesFilenames);

    // TODO: account for the fact that we won't have height/width of the image
    
    console.log('>>>>> twitter_video_canvas > creating directories if not exists...: ', `${localWorkingPath}/${workingDir}/`);
    await mkdir(`${localWorkingPath}/${workingDir}/`, { recursive: true }, (err) => {
        if (err) throw err;
    });

    console.log('>>>>> twitter_video_canvas > generating frames...');
    for (const frameFilename of framesFilenames) {
        const filenamePath = `${localWorkingPath}/${frameFilename}`;
        // console.log('!!! twitter_video_canvas > filenamePath: ', filenamePath);
    
        await singleVideoFrame(
            ctx,
            filenamePath,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth,
        );
        const canvasFilePath = `${localWorkingPath}/${workingDir}/${frameFilename}`;
        // console.log('>>>>> twitter_video_canvas > canvasFilePath: ', canvasFilePath);
        await writeFile(canvasFilePath, canvas.toBuffer('image/png'), { flag: 'w', encoding: 'utf8' });
    }

    // console.log('>>>>> twitter_video_canvas > framesPattern: ', framesPattern);
    // console.log('>>>>> twitter_video_canvas > localCompiledVideoOutputPath: ', localCompiledVideoOutputPath);
    console.log('>>>>> twitter_video_canvas > recombining canvassed frames into video...');
    await recombineFramesToVideo(framesPattern, localCompiledVideoOutputPath);

    // console.log('>>>>> twitter_video_canvas > localCompiledVideoOutputPath: ', localCompiledVideoOutputPath);
    // console.log('>>>>> twitter_video_canvas > localAudioPath: ', localAudioPath);
    // console.log('>>>>> twitter_video_canvas > recombinedFilePath: ', recombinedFilePath);


    const checkIfLocalAudioFileExists = async path => !!(await stat(localAudioPath).catch(e => false));
    const localAudioFileExists = await checkIfLocalAudioFileExists();
    let finalVideoFileExists = false;
    console.log('>>>>> twitter_video_canvas > localAudioFileExists: ', localAudioFileExists);
    if (localAudioFileExists) {
        console.log('>>>>> twitter_video_canvas > recombining audio with new video...');
        await combineAudioWithVideo(localCompiledVideoOutputPath, localAudioPath, recombinedFilePath);
        finalVideoFileExists = existsSync(recombinedFilePath);
    } else {
        finalVideoFileExists = existsSync(localCompiledVideoOutputPath);
    }

    return new Promise((resolve, reject) => {
        try {
            if(finalVideoFileExists) {
                return resolve(localAudioFileExists ? recombinedFilePath : localCompiledVideoOutputPath);
            }
            else {
                return reject('File does not yet exist!');
            }
        }
        catch (err) {
            return reject(err);
        }
        // nothing else happens because all we're doing, when this is done, is reading the file we created from the calling side
    });
    
};

module.exports = { createTwitterVideoCanvas };
