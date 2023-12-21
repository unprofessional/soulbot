const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url, message) => {
    const metadata = await unfurl(url);
    //     message.channel.send(`
    // \`\`\`JSON
    // ${JSON.stringify(metadata, null, 2)}
    // \`\`\``);

    const result = await fetch(url);
    console.log('>>>>> result: ', result);

    return metadata;
};

module.exports = {
    fetchMetadata,
};
