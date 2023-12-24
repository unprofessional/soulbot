const { createCanvas, loadImage } = require('canvas');

const TimeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

function getWrappedText(ctx, text, maxWidth) {
    console.log('>>>>> getWrappedText > text: ', text);
    const lines = [];
    const paragraphs = text.split('\n'); // Split the text into paragraphs
    paragraphs.forEach(paragraph => {
        console.log(`!!! 1-paragraph: ${paragraph}`);
        const shortTwitterUrlPattern = /https:\/\/t\.co\/\S+/;
        // if the URL is found anywhere in this string
        const containsUrl = shortTwitterUrlPattern.test(paragraph);
        console.log('!!! 2-containsUrl: ', containsUrl);
        const matches = paragraph.split(shortTwitterUrlPattern);
        console.log('!!! 3-matches: ', matches);
        if(containsUrl && matches[0]) {
            paragraph = matches[0];
        }
        console.log('================================');
        if (paragraph === '') {
            lines.push(''); // Handle blank lines (paragraph breaks)
        } else {
            const words = paragraph.split(' ');
            let currentLine = words[0];
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
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
    console.log('scaleDownByHalf > height: ', height);
    console.log('scaleDownByHalf > width: ', width);
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
  
    // Pre-process description with text wrapping
    const maxCharLength = 220; // Maximum width for text
    console.log('>>>>> createTwitterCanvas > metadata.description: ', metadata.description);
    const descLines = getWrappedText(ctx, metadata.description, maxCharLength);
    // console.log('>>>>> descLines.length: ', descLines.length);
    let yPosition = 110; // Starting Y position for description text

    // Find number of associated media
    const filteredMediaUrls = metadata.mediaUrls.filter((mediaUrl) => {
        const mediaUrlParts = mediaUrl.split('.');
        console.log('!!!!! mediaUrlParts: ', mediaUrlParts);
        console.log('!!!!! mediaUrlParts.length: ', mediaUrlParts.length);
        const fileExtension = mediaUrlParts[mediaUrlParts.length - 1];
        console.log('!!!!! fileExtension: ', fileExtension);
        return mediaUrl === 'jpg' || mediaUrl === 'jpeg' || mediaUrl === 'png';
    });
    const numOfImgs = metadata.mediaUrls.length;
    console.log('numOfImgs', numOfImgs);

    const mediaMaxHeight = 600;
    const mediaMaxWidth = 560;
    const hasImgs = numOfImgs > 0;

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
        console.log('>>>>> hasImgs > mediaObject: ', mediaObject);
        heightShim = mediaMaxHeight;
    }
  
    // New height calcs
    const descLinesLength = descLines.length;
    // console.log('>>>>> descLines: ', descLines);
    const calculatedCanvasHeightFromDescLines = (descLinesLength * 30) + yPosition + 40 + heightShim;
    // console.log('>>>>> calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);
  
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
  
    // Pre-process description with text wrapping
    ctx.fillStyle = 'white'; // Text color for description
    ctx.font = '24px Arial';
    const lineHeight = 30; // Line height
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
    ctx.drawImage(pfp, 20, 20, 50, 50); // Example position and size

    // Draw the image, if one exists...
    if (hasImgs) {
        const mainMedia1Url = metadata.mediaUrls[0];
        const mainMedia1 = await loadImage(mainMedia1Url);
        // Calculate the aspect ratio of the destination size
        const destAspectRatio = mediaMaxWidth / mediaMaxHeight;

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

        const position = calculatedCanvasHeightFromDescLines - mediaMaxHeight - 50;

        console.log('>>>>> hasImgs! drawing image...');
        // Draw the cropped image on the canvas
        ctx.drawImage(
            mainMedia1,
            sx, sy, cropWidth, cropHeight, // Source rectangle
            20, position, mediaMaxWidth, mediaMaxHeight // Destination rectangle
        );
    }

    // Convert the canvas to a Buffer and return it
    return canvas.toBuffer();
};

module.exports = { createTwitterCanvas };
