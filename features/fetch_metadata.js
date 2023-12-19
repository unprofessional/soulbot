const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url) => {
  const metadata = await unfurl(url);
  console.log('>>>>> fetchMetadata > metadata: ', metadata);
};

module.exports = { fetchMetadata };
