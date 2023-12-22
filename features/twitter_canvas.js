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
            lines.push(currentLine); // Push the last line of the paragraph
        }
    });
    return lines;
}

const formatTwitterDate = (twitterDate) => {
 // Parse the date string and create a Date object
  const date = new Date(twitterDate);
  return timeAgo.format(date);
  
  // Format hours for AM/PM
  // const hours = date.getHours();
  // const formattedHours = hours % 12 || 12; // Converts 0 (midnight) to 12
  // const amPm = hours < 12 ? 'AM' : 'PM';
  
  // // Format minutes
  // const minutes = date.getMinutes();
  // const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
  
  // // Format day and year
  // const day = date.getDate();
  // const year = date.getFullYear();
  
  // // Format month
  // const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // const month = monthNames[date.getMonth()];
  
  // // Construct the new date string
  // return `${formattedHours}:${formattedMinutes} ${amPm} · ${month} ${day}, ${year}`;  
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
  
    // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME 
    // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME 
    // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME 
    // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME 
    // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME 
    // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME 

    // Some descriptions have an undesireable shortened URL at the end
    const shortTwitterUrlPattern = /(.*?)(?:\s+https:\/\/t\.co\/\S+)?$/;
    const matchResult = metadata.description.match(shortTwitterUrlPattern);
    console.log('>>>>> matchResult: ', matchResult);
    const cleanedDescription = matchResult ? matchResult[0] : metadata.description;
    // Replace the old with the cleaned up version
    metadata.description = cleanedDescription;

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
