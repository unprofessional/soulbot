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
            console.log(`curentLine: ${currentLine}`);
            const shortTwitterUrlPattern = /(.*?)(?:\s+https:\/\/t\.co\/\S+)?$/;
            const matches = currentLine.match(shortTwitterUrlPattern);
            console.log('matches: ', matches);
          
            if(matches[0] !== matches[1] && !matches[0].test(shortTwitterUrlPattern)) {
              currentLine = matches[1];
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

const createTwitterCanvas = async (metadataJson) => {

    const metadata = {
      authorNick: metadataJson.user_screen_name,
      authorUsername: metadataJson.user_name,
      pfpUrl: metadataJson.user_profile_image_url,
      date: metadataJson.date, // TODO: date formatting...
      description: metadataJson.text || "",
      mediaURLs: metadataJson.mediaURLs,
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
  
    // New height calcs
    const descLinesLength = descLines.length;
    // console.log('>>>>> descLines: ', descLines);
    const calculatedCanvasHeightFromDescLines = (descLinesLength * 30) + yPosition + 40;
    // console.log('>>>>> calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);
  
    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines;
    ctx.fillRect(0, 0, maxCanvasWidth, calculatedCanvasHeightFromDescLines);

    // Load and draw favicon
    const favIconUrl = 'https://abs.twimg.com/favicons/twitter.3.ico';
    const favicon = await loadImage(favIconUrl);
    ctx.drawImage(favicon, 550, 20, 32, 32); // Example position and size
  
    // Draw text elements
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

    // Convert the canvas to a Buffer and return it
    return canvas.toBuffer();
};

module.exports = { createTwitterCanvas };
