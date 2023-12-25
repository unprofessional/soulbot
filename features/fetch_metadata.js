// const { unfurl } = require('unfurl.js');

const fetchMetadata = async (url, message, isXDotCom) => {
    // const metadata = await unfurl(url);
    //     message.channel.send(`
    // \`\`\`JSON
    // ${JSON.stringify(metadata, null, 2)}
    // \`\`\``);

    let parts = url.split("https://twitter.com/");
    if(isXDotCom) {
        parts = url.split("https://x.com/");
    }
    parts = url.split("https://twitter.com/");
    console.log('>>>>> fetchMetadata > parts: ', parts);
    const extractedPart = parts[1];
    const vxApiUrl = `https://api.vxtwitter.com/${extractedPart}`;
    const result = await fetch(vxApiUrl);

    if(result.status === 500) {
        console.log('>>>>> ERROR 500 > result: ', result);
        result.error = true;
        result.errorMsg = await result.text();
        return result;
    }

    let resultJson = {};
    try {
        resultJson = await result.json();
        console.log('>>>>> fetch > resultJson: ', resultJson);
    } catch (err) {
        console.log('>>>>> fetch > err: ', err);
        message.reply(`${err}`);
    }

    return resultJson;
};

module.exports = {
    fetchMetadata,
};
