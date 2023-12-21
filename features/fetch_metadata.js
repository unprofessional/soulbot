// const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url, message) => {
    // const metadata = await unfurl(url);
    //     message.channel.send(`
    // \`\`\`JSON
    // ${JSON.stringify(metadata, null, 2)}
    // \`\`\``);

    const parts = url.split("https://twitter.com/");
    const extractedPart = parts[1];
    const vxApiUrl = `https://api.vxtwitter.com/${extractedPart}`;
    const result = await fetch(vxApiUrl);
    try {
        const resultJson = await result.json();
        console.log('>>>>> fetch > resultJson: ', resultJson);
    } catch (err) {
        console.log('>>>>> fetch > err: ', err);
        message.reply(`${err}`);
    }

    return result;
};

module.exports = {
    fetchMetadata,
};
