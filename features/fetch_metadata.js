const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url, message) => {
    const metadata = await unfurl(url);
    //     message.channel.send(`
    // \`\`\`JSON
    // ${JSON.stringify(metadata, null, 2)}
    // \`\`\``);
    return metadata;
};

module.exports = {
    fetchMetadata,
};
