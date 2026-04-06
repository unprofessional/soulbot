async function safeDelete(message, label = 'progress message') {
    if (!message) return;

    try {
        await message.delete();
    } catch (error) {
        console.warn(`[progress] Failed to delete ${label}:`, error);
    }
}

function createNoopProgressHandle() {
    return {
        message: null,
        async update() {},
        async dismiss() {},
    };
}

function buildProgressHandle(progressMessage) {
    let dismissed = false;

    return {
        message: progressMessage,
        async update(content) {
            if (!progressMessage || dismissed || !content) return;

            try {
                await progressMessage.edit({ content });
            } catch (error) {
                console.warn('[progress] Failed to update progress message:', error);
            }
        },
        async dismiss() {
            if (!progressMessage || dismissed) return;
            dismissed = true;
            await safeDelete(progressMessage);
        },
    };
}

async function createVideoProgressMessage(
    message,
    content = 'Rendering the Twitter/X video canvas...'
) {
    try {
        const progressMessage = await message.reply({
            content,
            allowedMentions: { repliedUser: false },
        });

        return buildProgressHandle(progressMessage);
    } catch (replyError) {
        console.warn('[progress] Failed to create reply progress message:', replyError);
    }

    try {
        const progressMessage = await message.channel.send({ content });
        return buildProgressHandle(progressMessage);
    } catch (sendError) {
        console.warn('[progress] Failed to create channel progress message:', sendError);
        return createNoopProgressHandle();
    }
}

module.exports = {
    createVideoProgressMessage,
    safeDelete,
};
