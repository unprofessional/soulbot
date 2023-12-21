const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url, message) => {
    const metadata = await unfurl(url);
    //     message.channel.send(`
    // \`\`\`JSON
    // ${JSON.stringify(metadata, null, 2)}
    // \`\`\``);

    const result = await fetch(url);
    try {
        const resultJson = await result.json();
        console.log('>>>>> fetch > resultJson: ', resultJson);
    } catch (err) {
        console.log('>>>>> fetch > err: ', err);
    }

    return metadata;
};

module.exports = {
    fetchMetadata,
};
