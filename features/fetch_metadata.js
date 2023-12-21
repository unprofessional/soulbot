const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url, message) => {
    const metadata = await unfurl(url);
    //     message.channel.send(`
    // \`\`\`JSON
    // ${JSON.stringify(metadata, null, 2)}
    // \`\`\``);

    const result = await fetch(url);
    const resultJson = await result.json();
    console.log('>>>>> resultJson: ', resultJson);

    return metadata;
};

module.exports = {
    fetchMetadata,
};
