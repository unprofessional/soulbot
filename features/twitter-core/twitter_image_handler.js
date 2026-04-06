// features/twitter-core/twitter_image_handler.js

const { createTwitterCanvas } = require('../twitter-post/twitter_canvas.js');
const { sendWebhookProxyMsg } = require('./webhook_utils.js');
const { randomNameGenerator } = require('./utils.js');

async function handleImagePost({
    metadataJson,
    message,
    originalLink,
    processingRunId,
}) {
    console.log('>>>>> handleImagePost > Not a video');

    const buffer = await createTwitterCanvas(metadataJson);
    await message.suppressEmbeds(true);

    const files = [{
        attachment: buffer,
        name: `${processingRunId || randomNameGenerator()}.png`,
    }];

    const communityNotes = {
        main: metadataJson.communityNote,
        qt: metadataJson.qtMetadata?.communityNote,
    };

    try {
        await sendWebhookProxyMsg(message, 'Here’s the Twitter canvas:', files, communityNotes, originalLink);
    } catch (err) {
        console.warn('>>> handleImagePost > WEBHOOK FAILED!');
        await sendWebhookProxyMsg(message, `File(s) too large to attach! err: ${err}`, undefined, undefined, originalLink);
    }
}

module.exports = { handleImagePost };
