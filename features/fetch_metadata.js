const { unfurl } = require('unfurl.js');
const { createCanvas, loadImage } = require('canvas');

const fetchMetadata = async (url, message) => {
    const metadata = await unfurl(url);
    message.channel.send(`\`\`\`JSON
    ${JSON.stringify(metadata, null, 2)}
\`\`\``);
    return metadata;
};

const renderTwitterPost = async (metadataJson, message) => {
    const canvas = createCanvas(600, 400);
    const ctx = canvas.getContext('2d');
  
    // Draw something on the canvas
    // ctx.fillStyle = '#8E7A76';
    // ctx.fillRect(0, 0, 400, 200);
    // ctx.fillStyle = 'white';
    // ctx.font = '30px Arial';
    // ctx.fillText('Hello, Discord!', 50, 100);

    // Set background color
    ctx.fillStyle = metadataJson?.theme_color;
    // ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, 600, 400);

    // Load and draw favicon
    // const favicon = await loadImage(metadataJson.favicon);
    // ctx.drawImage(favicon, 10, 10, 32, 32); // Example position and size

    // Draw text elements
    ctx.fillStyle = 'white'; // Text color
    ctx.font = 'bold 16px Arial';
    ctx.fillText(metadataJson?.open_graph?.site_name, 50, 30); // Positioning example

    // Continue drawing other elements...

    // Draw main image
    const mainImageUrl = metadataJson?.open_graph?.images[0]?.url;
    console.log('>>>>> mainImageUrl: ', mainImageUrl);
    const mainImage = await loadImage(mainImageUrl);
    ctx.drawImage(mainImage, 50, 100, 500, 250); // Example position and size

    // Convert the canvas to a Buffer
    const buffer = canvas.toBuffer();

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
