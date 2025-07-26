// features/ollama/vision_handler.js

const { fetchImageAsBase64 } = require('./vision.js');
const { sendPromptToOllama } = require('./index.js');

/**
 * Handles Ollama vision prompts, including custom or fixed prompt types.
 * @param {Object} message - The Discord message object.
 * @param {'default'|'catvision'} mode - Vision mode for prompt logic.
 */
async function handleVisionCommand(message, mode = 'default') {
    const images = message.attachments.filter(att => att.contentType?.startsWith('image/'));
    if (images.size === 0) return;

    await message.channel.send('Processing your image, please wait...');

    for (const [, image] of images) {
        try {
            const base64Image = await fetchImageAsBase64(image.url);
            const userPrompt = mode === 'catvision'
                ? undefined // special prompt for catvision handled inside `sendPromptToOllama`
                : message.content || 'Analyze this image. Please be brief and concise.';

            const result = await sendPromptToOllama(userPrompt, base64Image, mode);
            await message.reply(mode === 'default' ? `Response:\n\n${result}` : result);
        } catch (error) {
            console.error(`[vision_handler] Error:`, error);
            await message.reply('An error occurred while processing your image.');
        }
    }
}

module.exports = {
    handleVisionCommand,
};
