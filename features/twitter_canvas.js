const { createCanvas, loadImage } = require('canvas');

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
                console.log('!!!!! getWrappedText > width: ', width);
                console.log('!!!!! getWrappedText > maxWidth: ', maxWidth);
              
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

const scaleDownByHalf = (
    { height, width },
    mediaMaxHeight,
    mediaMaxWidth,
) => {
    // console.log('>>>>> scaleDownByHalf > height: ', height);
    // console.log('>>>>> scaleDownByHalf > width: ', width);
    if(height < mediaMaxHeight && width < mediaMaxWidth) {
        return {
            height,
            width,
        };
    }
    return scaleDownByHalf(
        {
            height: Math.floor(height/2),
            width: Math.floor(width/2),
        },
        mediaMaxHeight,
        mediaMaxWidth,
    );
};

const formatTwitterDate = (twitterDate) => {
    // Parse the date string and create a Date object
    const date = new Date(twitterDate);
    return timeAgo.format(date); 
};

const createTwitterCanvas = async (metadataJson) => {

    const metadata = {
        authorNick: metadataJson.user_screen_name,
        authorUsername: metadataJson.user_name,
        pfpUrl: metadataJson.user_profile_image_url,
        date: metadataJson.date, // TODO: date formatting...
        description: metadataJson.text || "",
        mediaUrls: metadataJson.mediaURLs,
        mediaExtended: metadataJson.media_extended,
    };

    console.log('>>>>> createTwitterCanvas > metadata: ', metadata);

    const maxCanvasWidth = 600;
    let canvasHeight = 650;
    const canvas = createCanvas(maxCanvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background color
    ctx.fillStyle = '#000';

    // Find number of associated media
    const filteredMediaUrls = metadata.mediaUrls.filter((mediaUrl) => {
        const mediaUrlParts = mediaUrl.split('.');
        // console.log('!!!!! mediaUrlParts: ', mediaUrlParts);
        // console.log('!!!!! mediaUrlParts.length: ', mediaUrlParts.length);
        const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        // console.log('!!!!! fileExtensionWithQueryParams: ', fileExtensionWithQueryParams);
        const fileExtension = fileExtensionWithQueryParams.split('?')[0];
        // console.log('!!!!! fileExtension: ', fileExtension);
        return fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png';
    });

    const filteredVideoUrls = metadata.mediaUrls.filter((mediaUrl) => {
        const mediaUrlParts = mediaUrl.split('.');
        // console.log('!!!!! mediaUrlParts: ', mediaUrlParts);
        // console.log('!!!!! mediaUrlParts.length: ', mediaUrlParts.length);
        const fileExtensionWithQueryParams = mediaUrlParts[mediaUrlParts.length - 1];
        // console.log('!!!!! fileExtensionWithQueryParams: ', fileExtensionWithQueryParams);
        const fileExtension = fileExtensionWithQueryParams.split('?')[0];
        // console.log('!!!!! fileExtension: ', fileExtension);
        return fileExtension === 'mp4'
    });

    const numOfImgs = filteredMediaUrls.length;
    console.log('>>>>> createTwitterCanvas > numOfImgs', numOfImgs);
    const numOfVideos = filteredVideoUrls.length;
    console.log('>>>>> createTwitterCanvas > numOfVideos', numOfVideos);
    let mediaMaxHeight = numOfImgs > 1 ? 530 : 600;
    let mediaMaxWidth = 560;
    const hasImgs = numOfImgs > 0;
    const hasVids = numOfVideos > 0;

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
        // mediaObject = scaleDownByHalf(mediaObject, mediaMaxHeight, mediaMaxWidth);
        // console.log('>>>>> hasImgs > mediaObject: ', mediaObject);
        if(mediaObject.width > mediaObject.height) {
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
    const maxCharLength = !hasImgs && hasVids ? 160 : 220; // Maximum width for text
    const descLines = getWrappedText(ctx, metadata.description, maxCharLength, hasVids);
    let yPosition = 110; // Starting Y position for description text

    // New height calcs
    const descLinesLength = descLines.length;
    const calculatedCanvasHeightFromDescLines = hasVids && !hasImgs
        ? maxCanvasWidth // Has vids, make square
        : (descLinesLength * 30) + yPosition + 40 + heightShim;

  
    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines;
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines);

    // Load and draw favicon
    const favIconUrl = 'https://abs.twimg.com/favicons/twitter.3.ico';
    const favicon = await loadImage(favIconUrl);
    ctx.drawImage(favicon, 550, 20, 32, 32); // Example position and size
  
    // Draw nickname elements
    ctx.fillStyle = 'white'; // Text color
    ctx.font = 'bold 18px Arial';
    ctx.fillText(metadata.authorUsername, 100, 40);

    // Draw username elements
    ctx.fillStyle = 'gray'; // Text color
    ctx.font = '18px Arial';
    ctx.fillText(`@${metadata.authorNick}`, 100, 60);
  
    // Draw description (post text wrap handling)
    ctx.fillStyle = 'white'; // Text color for description
    ctx.font = !hasImgs && hasVids ? '36px Arial' : '24px Arial';
    const lineHeight = !hasImgs && hasVids ? 40 : 30; // Line height
    descLines.forEach(line => {
        ctx.fillText(line, 30, yPosition);
        yPosition += lineHeight;
    });

    // Draw date elements
    ctx.fillStyle = 'gray'; // Text color
    ctx.font = '18px Arial';
    ctx.fillText(`${formatTwitterDate(metadata.date)} from this posting`, 30, calculatedCanvasHeightFromDescLines - 20);
  
    // Draw pfp image
    const pfpUrl = metadata.pfpUrl;
    const pfp = await loadImage(pfpUrl);
    ctx.drawImage(pfp, 20, 20, 50, 50);

    /**
     * REFACTOR ATTEMPT - REFACTOR ATTEMPT - REFACTOR ATTEMPT
     * REFACTOR ATTEMPT - REFACTOR ATTEMPT - REFACTOR ATTEMPT
     * REFACTOR ATTEMPT - REFACTOR ATTEMPT - REFACTOR ATTEMPT
     */
    const scaleToFitWiderThanHeight = (mainMedia1, xPosition) => {
        const newWidthRatio = mediaMaxWidth / mainMedia1.width;
        console.log('>>>>> newWidthRatio: ', newWidthRatio);
        const adjustedHeight = mainMedia1.height * newWidthRatio;
        console.log('>>>>> adjustedHeight: ', adjustedHeight);
        ctx.drawImage(
            mainMedia1,
            // sx, sy, cropWidth, cropHeight, // Source rectangle
            20, xPosition, mediaMaxWidth, adjustedHeight // Destination rectangle
        );
    };

    const cropSingleImage = (mainMedia1, maxHeight, maxWidth, xPosition, yPosition) => {
        /** CROPPING LOGIC */
        // crop from the center of the image
        // Calculate the aspect ratio of the destination size
        const destAspectRatio = maxWidth / maxHeight;
        // Determine the cropping size (maintaining the destination aspect ratio)
        let cropWidth, cropHeight;
        if (mainMedia1.width / mainMedia1.height > destAspectRatio) {
            // Image is wider than destination aspect ratio
            cropHeight = mainMedia1.height;
            cropWidth = mainMedia1.height * destAspectRatio;
        } else {
            // Image is taller than destination aspect ratio
            cropWidth = mainMedia1.width;
            cropHeight = mainMedia1.width / destAspectRatio;
        }
        // Calculate starting point (top left corner) for cropping
        const sx = (mainMedia1.width - cropWidth) / 2;
        const sy = (mainMedia1.height - cropHeight) / 2;
        // Draw the cropped image on the canvas
        ctx.drawImage(
            mainMedia1,
            sx, sy, cropWidth, cropHeight, // Source rectangle
            xPosition, yPosition, maxWidth, maxHeight // Destination rectangle
        );
    };

    // Draw the image, if one exists...
    if (hasImgs && !hasVids) {
        /** Single Image */
        if(metadata.mediaUrls.length === 1) {
            const mainMedia1Url = metadata.mediaUrls[0];
            const mainMedia1 = await loadImage(mainMedia1Url);
            if (mainMedia1.width > mainMedia1.height) {
                const xPosition = 20;
                scaleToFitWiderThanHeight(mainMedia1, xPosition);
            } else {
                const position = calculatedCanvasHeightFromDescLines - heightShim - 50;
                cropSingleImage(mainMedia1, mediaMaxHeight, mediaMaxWidth, position);
            }
        }
        /** Two images */
        if(metadata.mediaUrls.length === 2) {
            const mainMedia1Url = metadata.mediaUrls[0];
            const mainMedia1 = await loadImage(mainMedia1Url);
            const firstXPosition = 20;
            const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
            cropSingleImage(mainMedia1, mediaMaxHeight / 2, mediaMaxWidth / 2, firstXPosition, firstYPosition);

            const mainMedia2Url = metadata.mediaUrls[1];
            const mainMedia2 = await loadImage(mainMedia2Url);
            const secondXPosition = mediaMaxWidth / 2 + 25;
            const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
            cropSingleImage(mainMedia2, mediaMaxHeight / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);
        }
        /** Three images */
        if(metadata.mediaUrls.length === 3) {
            const mainMedia1Url = metadata.mediaUrls[0];
            const mainMedia1 = await loadImage(mainMedia1Url);
            const firstXPosition = 20;
            const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
            cropSingleImage(mainMedia1, mediaMaxHeight / 2, mediaMaxWidth / 2, firstXPosition, firstYPosition);

            const mainMedia2Url = metadata.mediaUrls[1];
            const mainMedia2 = await loadImage(mainMedia2Url);
            const secondXPosition = mediaMaxWidth / 2 + 25;
            const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
            cropSingleImage(mainMedia2, mediaMaxHeight / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

            const mainMedia3Url = metadata.mediaUrls[2];
            const mainMedia3 = await loadImage(mainMedia3Url);
            const thirdXPosition = 20;
            const thirdYPosition = mediaMaxHeight / 2 + 135;
            cropSingleImage(mainMedia3, mediaMaxHeight / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);
        }
        /** Four images */
        if(metadata.mediaUrls.length === 4) {
            const mainMedia1Url = metadata.mediaUrls[0];
            const mainMedia1 = await loadImage(mainMedia1Url);
            const firstXPosition = 20;
            const firstYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
            cropSingleImage(mainMedia1, mediaMaxHeight / 2, mediaMaxWidth / 2, firstXPosition, firstYPosition);

            const mainMedia2Url = metadata.mediaUrls[1];
            const mainMedia2 = await loadImage(mainMedia2Url);
            const secondXPosition = mediaMaxWidth / 2 + 25;
            const secondYPosition = calculatedCanvasHeightFromDescLines - heightShim - 50;
            cropSingleImage(mainMedia2, mediaMaxHeight / 2, mediaMaxWidth / 2, secondXPosition, secondYPosition);

            const mainMedia3Url = metadata.mediaUrls[2];
            const mainMedia3 = await loadImage(mainMedia3Url);
            const thirdXPosition = 20;
            const thirdYPosition = mediaMaxHeight / 2 + 135;
            cropSingleImage(mainMedia3, mediaMaxHeight / 2, mediaMaxWidth / 2, thirdXPosition, thirdYPosition);

            const mainMedia4Url = metadata.mediaUrls[3];
            const mainMedia4 = await loadImage(mainMedia4Url);
            const fourthXPosition = mediaMaxWidth / 2 + 25;
            const fourthYPosition = mediaMaxHeight / 2 + 135;
            cropSingleImage(mainMedia4, mediaMaxHeight / 2, mediaMaxWidth / 2, fourthXPosition, fourthYPosition);

        }
    }

    // Convert the canvas to a Buffer and return it
    return canvas.toBuffer();
};

module.exports = { createTwitterCanvas };
