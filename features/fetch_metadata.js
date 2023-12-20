const { unfurl } = require('unfurl.js');
const { createCanvas, loadImage } = require('canvas');

const fetchMetadata = async (url, message) => {
    const metadata = await unfurl(url);
    message.channel.send(`\`\`\`JSON
    ${JSON.stringify(metadata, null, 2)}
\`\`\``);
    return metadata;
};

// Text wrapping function
// function getWrappedText(ctx, text, maxWidth) {
//   const words = text.split(' ');
//   const lines = [];
//   let currentLine = words[0];

//   for (let i = 1; i < words.length; i++) {
//       const word = words[i];
//       const width = ctx.measureText(currentLine + " " + word).width;
//       if (width < maxWidth) {
//           currentLine += " " + word;
//       } else {
//           lines.push(currentLine);
//           currentLine = word;
//       }
//   }
//   lines.push(currentLine);
//   return lines;
// }

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


const renderTwitterPost = async (metadataJson, message) => {
    const canvas = createCanvas(600, 400);
    const ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = metadataJson?.theme_color;
    // ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, 600, 400);

    // Load and draw favicon
    const favicon = await loadImage(metadataJson.favicon);
    ctx.drawImage(favicon, 10, 10, 32, 32); // Example position and size

    // Draw text elements
    ctx.fillStyle = 'white'; // Text color
    ctx.font = 'bold 16px Arial';
    ctx.fillText(metadataJson?.open_graph?.title, 50, 30); // Positioning example

    // Draw description with text wrapping
    ctx.fillStyle = 'white'; // Text color for description
    ctx.font = '14px Arial';
    const maxWidth = 500; // Maximum width for text
    const lineHeight = 20; // Line height
    const lines = getWrappedText(ctx, metadataJson.open_graph.description, maxWidth);
    let yPosition = 60; // Starting Y position for description text
    lines.forEach(line => {
        ctx.fillText(line, 50, yPosition);
        yPosition += lineHeight;
    });

    // Draw main image
    const mainImageUrl = metadataJson?.open_graph?.images[0]?.url;
    // console.log('>>>>> mainImageUrl: ', mainImageUrl);
    // const mainImage = await loadImage(mainImageUrl);
    // ctx.drawImage(mainImage, 50, 100, 500, 250); // Example position and size

    // Convert the canvas to a Buffer
    const buffer = canvas.toBuffer();

    // TODO: Pull image and add it as a separate image/file
    

    // Create a MessageAttachment and send it
    message.channel.send({
        files: [{
            attachment: buffer,
            name: 'image.png'
        }]
    });
};

module.exports = {
    fetchMetadata,
    renderTwitterPost,
};
