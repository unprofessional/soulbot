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
        async updateVideoEncodeProgress() {},
        async dismiss() {},
    };
}

function formatClock(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
    }

    return [minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
}

function buildProgressBar(percent, width = 12) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    const filled = Math.max(0, Math.min(width, Math.round((safePercent / 100) * width)));
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

function formatVideoEncodeProgress({
    percent = 0,
    currentSeconds = 0,
    totalSeconds = 0,
}) {
    const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const progressBar = buildProgressBar(safePercent);
    return `Encoding Twitter/X video... ${progressBar} ${safePercent}% (${formatClock(currentSeconds)} / ${formatClock(totalSeconds)})`;
}

function buildProgressHandle(progressMessage) {
    let dismissed = false;
    let lastUpdateAt = 0;
    let lastRenderedContent = '';

    const applyUpdate = async (content, { force = false } = {}) => {
        if (!progressMessage || dismissed || !content) return;

        const now = Date.now();
        const minUpdateGapMs = 1500;
        if (!force && content === lastRenderedContent) return;
        if (!force && lastUpdateAt && now - lastUpdateAt < minUpdateGapMs) return;

        try {
            await progressMessage.edit({ content });
            lastUpdateAt = now;
            lastRenderedContent = content;
        } catch (error) {
            console.warn('[progress] Failed to update progress message:', error);
        }
    };

    return {
        message: progressMessage,
        async update(content, options) {
            await applyUpdate(content, options);
        },
        async updateVideoEncodeProgress(progress) {
            const content = formatVideoEncodeProgress(progress);
            const safePercent = Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0)));
            await applyUpdate(content, { force: safePercent >= 100 });
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
    formatVideoEncodeProgress,
    safeDelete,
};
