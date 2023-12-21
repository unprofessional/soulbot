const { createCanvas, loadImage } = require('canvas');

function getWrappedText(ctx, text, maxWidth) {
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

const createTwitterCanvas = async (metadataJson) => {
    const maxCanvasWidth = 600;
    const canvas = createCanvas(maxCanvasWidth, 400);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = metadataJson.theme_color;
    ctx.fillRect(0, 0, 600, 400);

    // // Load and draw favicon
    const favicon = await loadImage(metadataJson.favicon);
    ctx.drawImage(favicon, 550, 10, 32, 32); // Example position and size
  
    let canvasHeight = 650;
  
    ctx.canvas.height = canvasHeight;
    ctx.fillRect(0, 0, 600, canvasHeight);
  
    // Pre-process description with text wrapping
    const maxCharLength = 220; // Maximum width for text
    const descLines = getWrappedText(ctx, metadataJson.open_graph.description, maxCharLength);
    // console.log('>>>>> descLines.length: ', descLines.length);
    let yPosition = 110; // Starting Y position for description text
  
    // New height calcs
    const descLinesLength = descLines.length;
    // console.log('>>>>> descLines: ', descLines);
    const calculatedCanvasHeightFromDescLines = (descLinesLength * 30) + yPosition + 20;
    // console.log('>>>>> calculatedCanvasHeightFromDescLines: ', calculatedCanvasHeightFromDescLines);
  
    // Re-calc canvas
    ctx.canvas.height = calculatedCanvasHeightFromDescLines;
    ctx.fillRect(0, 0, 600, calculatedCanvasHeightFromDescLines);
  
    // Draw text elements
    ctx.fillStyle = 'white'; // Text color
    ctx.font = 'bold 18px Arial';
    ctx.fillText(metadataJson?.open_graph?.title, 100, 40);
  
    // Pre-process description with text wrapping
    ctx.fillStyle = 'white'; // Text color for description
    ctx.font = '24px Arial';
    const lineHeight = 30; // Line height
    descLines.forEach(line => {
        ctx.fillText(line, 30, yPosition);
        yPosition += lineHeight;
    });
  
    // Draw main image
    const mainImage = await loadImage("https://abs.twimg.com/favicons/twitter.3.ico");
    ctx.drawImage(mainImage, 20, 20, 50, 50); // Example position and size

    // Convert the canvas to a Buffer and return it
    return canvas.toBuffer();
};

module.exports = { createTwitterCanvas };
