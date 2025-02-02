const fetchMetadata = async (url, message, isXDotCom) => {
    const urlPattern = isXDotCom ? 'https://x.com/' : 'https://twitter.com/';
    const parts = url.split(urlPattern);
    // console.log('>>>>> fetchMetadata > parts: ', parts);
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
        // console.log('>>>>> fetch > resultJson: ', resultJson);
    } catch (err) {
        // console.log('>>>>> fetch > err: ', err);
        message.reply(`${err}`);
    }

    return resultJson;
};

const fetchQTMetadata = async (url, message) => {
    const urlPattern = 'https://twitter.com/';
    const parts = url.split(urlPattern);
    // console.log('>>>>> fetchMetadata > parts: ', parts);
    const extractedPart = parts[1];
    const vxApiUrl = `https://api.vxtwitter.com/${extractedPart}`;
    const result = await fetch(vxApiUrl);

    if(result.status === 500) {
        console.error(`>>>>> ERROR 500 (quote-tweet url: ${url}) > result: ${result}`);
        result.error = true;
        result.errorMsg = await result.text();
        return result;
    }

    let resultJson = {};
    try {
        // console.log('>>>>> fetchQTMetadata > result (before async/await): ', result);
        resultJson = await result.json();
        console.log(`>>>>> fetchQTMetadata > resultJson: ${resultJson}`);
    } catch (err) {
        console.error(`>>>>> fetchQTMetadata > err: ${err}`);
        // message.reply(`${err}`);
        if(err === 'SyntaxError: Unexpected token < in JSON at position 0') {
            // This is the best we get with result.json()...
            // Most likely scenario
            resultJson = {
                error: 'No status found with that ID.',
                message: 'This post is unavailable.'
            };
        }
    }

    return resultJson;
};

module.exports = {
    fetchMetadata,
    fetchQTMetadata,
};
