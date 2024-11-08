const {
    // registerFont,
    createCanvas,
    loadImage,
} = require('canvas');
const { cropSingleImage } = require('./crop_single_image.js');
const { renderImageGallery } = require('./image_gallery_rendering.js');

const TimeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
const { scaleDownToFitAspectRatio } = require('./scale_down.js');
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
                const width = ctx.measureText(currentLine + ' ' + word).width;
                // console.log('!!!!! getWrappedText > width: ', width);
                // console.log('!!!!! getWrappedText > maxWidth: ', maxWidth);
              
                if (width < maxWidth) {
                    currentLine += ' ' + word;
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

const createTwitterCanvas = async (metadataJson, isImage) => {

    const removeTCOLink = (text) => {
        if(!text) {
            return '';
        }
        const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/;
        const filteredText = text.replace(shortTwitterUrlPattern, '');
        return filteredText;
    };

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date,
        description: removeTCOLink(metadataJson.text),
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
    };

    let qtMetadata = null;
    if(metadataJson.qtMetadata) {
        qtMetadata = {
            authorNick: metadataJson.qtMetadata.user_screen_name,
            authorUsername: metadataJson.qtMetadata.user_name,
            pfpUrl: metadataJson.qtMetadata.user_profile_image_url,
            date: metadataJson.qtMetadata.date,
            description: metadataJson.qtMetadata.text || '', // TODO: truncate
            mediaUrls: metadataJson.qtMetadata.mediaURLs,
            mediaExtended: metadataJson.qtMetadata.media_extended,
        };
    }

    console.log('>>>>> createTwitterCanvas > metadata: ', metadata);

    // Unnecessary if the font is loaded in the local OS
    // TODO: Investigate if `fonts/` is even necessary...
    // registerFont('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', { family: 'Noto Color Emoji' });
    const globalFont = 'Arial';

    const maxCanvasWidth = 600;
    let canvasHeight = 650;
    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    // Find number of associated media
    const filterMediaUrls = (metadata, extensions) => {
        return metadata.mediaUrls.filter((mediaUrl) => {
            const mediaUrlParts = mediaUrl.split('.');
            const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
            const fileExtension = fileExtensionWithQueryParams.split('?')[0];
            return extensions.includes(fileExtension);
        });
    };

    // Height adjustment for images
    const getMaxHeight = (numImgs) => {
        switch(numImgs) {
        case 1: return 800;
        case 2: return 600;
        case 3: return 530;
        case 4: return 530;
        default: return 600;
        }
    };

    const numOfImgs = filterMediaUrls(metadata, ['jpg', 'jpeg', 'png']).length;
    console.log('>>>>> createTwitterCanvas > numOfImgs', numOfImgs);
    const numOfVideos = filterMediaUrls(metadata, ['mp4']).length;
    console.log('>>>>> createTwitterCanvas > numOfVideos', numOfVideos);
    let mediaMaxHeight = getMaxHeight(numOfImgs);
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
        // Recusively scale down by half if larger than allowed
        // console.log('>>>>> hasImgs > mediaObject: ', mediaObject);
        mediaObject = scaleDownToFitAspectRatio(mediaObject, mediaMaxHeight, mediaMaxWidth);
        if(metadata.mediaExtended.length < 2 && mediaObject.width > mediaObject.height) {
            const newWidthRatio = mediaMaxWidth / mediaObject.width;
            // console.log('>>>>> newWidthRatio: ', newWidthRatio);
            const adjustedHeight = mediaObject.height * newWidthRatio;
            // console.log('>>>>> adjustedHeight: ', adjustedHeight);
            heightShim = adjustedHeight;    
        } else {
            // heightShim = mediaMaxHeight;
            console.log('>>> mediaObject.height: ', mediaObject.height);
            console.log('>>> mediaMaxHeight: ', mediaMaxHeight);
            heightShim = mediaObject.height < mediaMaxHeight ? mediaObject.height : mediaMaxHeight;
        }
    }

    const calcQtHeight = (qtMetadata) => {
        let minHeight = 180;
        
        // TODO: Calculate new descLines here
        const qtDescLines = getWrappedText(ctx, qtMetadata.description, 120, hasOnlyVideos);
        console.log('>>> qtDescLines: ', qtDescLines);
        const descLinesFilteredEmptyLines = qtDescLines.filter(line => line !== '');
        console.log('>>> descLinesFilteredEmptyLines: ', descLinesFilteredEmptyLines);
        const descLinesLength = descLinesFilteredEmptyLines?.length;
        console.log('>>> descLinesLength: ', descLinesLength);
        
        // If Media exists
        if(qtMetadata.mediaUrls.length > 0) {
            console.log('>>>>> calcQtHeight has media!');
            minHeight = 330;
        }
        const totalDescLinesHeight = descLinesLength * 40;
        return minHeight > totalDescLinesHeight ? minHeight : totalDescLinesHeight;
    };
  
    // Pre-process description with text wrapping
    const maxCharLength = hasOnlyVideos ? 120 : 220; // Maximum width for text
    const descLines = getWrappedText(ctx, metadata.description, maxCharLength, hasOnlyVideos);
    let defaultYPosition = 110; // Starting Y position for description text

    // New height calcs
    const descLinesLength = descLines.length;
    let calculatedCanvasHeightFromDescLines = hasVids && !hasImgs
        ? maxCanvasWidth // Has vids, make square
        : (descLinesLength * 30) + defaultYPosition + 40 + heightShim;
    if(!metadata.description) {
        calculatedCanvasHeightFromDescLines = calculatedCanvasHeightFromDescLines - 40;
    }

    let qtCalculatedCanvasHeightFromDescLines = 0;
    if(qtMetadata) {
        qtCalculatedCanvasHeightFromDescLines = calcQtHeight(qtMetadata); 
    }

    console.log('>>>>> calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);
    console.log('>>>>> qtCalculatedCanvasHeightFromDescLines: ', qtCalculatedCanvasHeightFromDescLines);
  
    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines + qtCalculatedCanvasHeightFromDescLines;
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines + qtCalculatedCanvasHeightFromDescLines);

    /** TODO TODO TODOTODO TODO TODOTODO TODO TODOTODO TODO TODOTODO TODO TODOTODO TODO
     * REFACTOR CONSIDERATIONS: Rather than separate by PRIMARY TWEET Draw vs QT Draw,
     * — let's instead break out each of these 'Draw ______ element' into their own functions
     * — so we can parameterize them
     */
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
    
        // Draw the circle mask...
        ctx.save();
        const radius = 25;
        ctx.beginPath();
        ctx.arc(45, 45, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        // Draw the image centered in the circle
        ctx.drawImage(pfp, 20, 20, 50, radius * 2);
        ctx.restore();

        // Draw pfp image
        // ctx.drawImage(pfp, 20, 20, 50, 50);
    };

    const drawQtBasicElements = (qtMeta, pfp, mainMedia1, qtVidThumbnail) => {
        console.log('>>>>> drawQtBasicElements > qtMeta: ', qtMeta);
        
        // Pre-process media
        const numOfQtImgs = filterMediaUrls(qtMeta, ['jpg', 'jpeg', 'png']).length;
        console.log('>>>>> qtMeta > createTwitterCanvas > numOfQtImgs', numOfQtImgs);
        const numOfQtVideos = filterMediaUrls(qtMeta, ['mp4']).length;
        console.log('>>>>> qtMeta > createTwitterCanvas > numOfQtVideos', numOfQtVideos);
        const hasMedia = numOfQtImgs > 0 || numOfQtVideos > 0;
        
        const minHeight = 100;
        let mediaQtMaxHeight = hasMedia ? 300 : minHeight;
        let mediaQtMaxWidth = 560;
        
        // Pre-process description with text wrapping
        const qtMaxCharLength = hasMedia ? 250 : 320; // Maximum width for text
        const qtDescLines = getWrappedText(ctx, qtMeta.description, qtMaxCharLength, true);
        
        const qtXPosition = 20;
        let qtYPosition = calculatedCanvasHeightFromDescLines;
        
        // QT Canvas Stroke
        ctx.strokeStyle = 'gray';
        console.log('>>> mediaQtMaxHeight: ', mediaQtMaxHeight);
        const minMediaHeight = 300;
        const determinedHeight = minMediaHeight > qtCalculatedCanvasHeightFromDescLines ? minMediaHeight : qtCalculatedCanvasHeightFromDescLines;
        ctx.strokeRect(qtXPosition, qtYPosition, mediaQtMaxWidth, determinedHeight - 20); // 20 offset to match the left and right margins
        
        // Draw nickname elements
        ctx.fillStyle = 'white'; // Text color
        ctx.font = 'bold 18px ' + globalFont;
        ctx.fillText(qtMeta.authorUsername, 100, qtYPosition + 40);
      
        // Draw username elements
        ctx.fillStyle = 'gray'; // Text color
        ctx.font = '18px ' + globalFont;
        ctx.fillText(`@${qtMeta.authorNick}`, 100, qtYPosition + 60);
      
        // Draw description (post text wrap handling)
        ctx.fillStyle = 'white'; // Text color for description
        ctx.font = '24px ' + globalFont;
        const lineHeight = 30;
        const qtTextXAxisStart = hasMedia ? 230 : 100;
        qtDescLines.forEach(line => {
            ctx.fillText(line, qtTextXAxisStart, qtYPosition + 100);
            qtYPosition += lineHeight;
        });

        // Draw pfp image
        ctx.drawImage(pfp, 40, calculatedCanvasHeightFromDescLines + 20, 50, 50);
        
        const qtMediaYPos = calculatedCanvasHeightFromDescLines + 80;
        console.log('>>>>> qtMediaYPos: ', qtMediaYPos);

        // or if (mainMedia1 !== undefined)
        if(numOfQtImgs > 0 && numOfQtVideos === 0) {
            cropSingleImage(ctx, mainMedia1, 175, 175, qtXPosition + 20, qtMediaYPos);
        }

        // or if (qtVidThumbnail)
        if(numOfQtVideos > 0) {
            cropSingleImage(ctx, qtVidThumbnail, 175, 175, qtXPosition + 20, qtMediaYPos);
        }
        
    };
    
    const favIconUrl = 'https://abs.twimg.com/favicons/twitter.3.ico';
    const favicon = await loadImage(favIconUrl);
    const pfpUrl = metadata.pfpUrl;
    const pfp = await loadImage(pfpUrl);
    drawBasicElements(metadata, favicon, pfp);
    console.log('>>>>> qtMetadata: ', qtMetadata);
    // if has quote tweet reference
    if(qtMetadata) {
        console.log('>>>>> if(qtMetadata) > qtMetadata EXISTS!!!');
        // Pre-process media
        const numOfQtImgs = filterMediaUrls(qtMetadata, ['jpg', 'jpeg', 'png']).length;
        console.log('>>>>> if(qtMetadata) > numOfQtImgs', numOfQtImgs);
        const numOfQtVideos = filterMediaUrls(qtMetadata, ['mp4']).length;
        console.log('>>>>> if(qtMetadata) > numOfQtVideos', numOfQtVideos);

        // load media
        const qtPfpUrl = qtMetadata.pfpUrl;
        const qtPfp = await loadImage(qtPfpUrl);

        // has images, but no videos
        if(numOfQtImgs > 0 && numOfQtVideos === 0) {
            const qtMainMedia1Url = qtMetadata.mediaUrls[0];
            const qtMainMedia1 = await loadImage(qtMainMedia1Url);
            drawQtBasicElements(qtMetadata, qtPfp, qtMainMedia1); 
        }
        // has videos, but no images
        if (numOfQtVideos > 0 && numOfQtImgs === 0) {
            const qtVidThumbnailUrl = qtMetadata.mediaExtended[0].thumbnail_url;
            const qtVidThumbnail = await loadImage(qtVidThumbnailUrl);
            drawQtBasicElements(qtMetadata, qtPfp, undefined, qtVidThumbnail); 
        }
        // is text only
        if (numOfQtVideos === 0 && numOfQtImgs === 0) {
            drawQtBasicElements(qtMetadata, qtPfp); 
        }
    }

    // Draw the image, if one exists...
    if (hasImgs && !hasVids) {

        /**
         * FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME 
         */
        // Media Canvas Stroke
        // ctx.strokeStyle = 'gray';
        // const zxPosition = 20;
        // const zyPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
        // ctx.strokeRect(zxPosition, zyPosition, mediaMaxWidth, mediaMaxHeight);

        await renderImageGallery(
            ctx,
            metadata,
            calculatedCanvasHeightFromDescLines,
            heightShim,
            mediaMaxHeight,
            mediaMaxWidth,
            defaultYPosition,
        );
    }

    // Convert the canvas to a Buffer and return it
    return isImage ? canvas.toBuffer('image/png') : canvas.toBuffer();
};

module.exports = { createTwitterCanvas };
