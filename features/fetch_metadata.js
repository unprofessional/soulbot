const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url, message) => {
  const metadata = await unfurl(url);
  console.log('>>>>> fetchMetadata > metadata: ', JSON.stringify(metadata, null, 2));
  message.channel.send(JSON.stringify(metadata, null, 2));
};

module.exports = { fetchMetadata };
