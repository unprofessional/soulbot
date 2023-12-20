const { unfurl } = require('unfurl.js');
const { createCanvas } = require('canvas');

const fetchMetadata = async (url, message) => {
  const metadata = await unfurl(url);
  message.channel.send(JSON.stringify(metadata, null, 2));
  return metadata;
};

const renderTwitterPost = async (metadataJson, message) => {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  
  // Draw something on the canvas
  ctx.fillStyle = 'blue';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.font = '30px Arial';
  ctx.fillText('Hello, Discord!', 50, 100);

  // Convert the canvas to a Buffer
  const buffer = canvas.toBuffer();

  // Create a MessageAttachment and send it
  // const attachment = new Discord.MessageAttachment(buffer, 'image.png');
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
