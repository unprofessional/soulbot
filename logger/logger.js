const { createLogger, format, transports } = require('winston');
const { addMessage } = require('../store/services/messages.service');

// Message formatter for Discord messages
const formatLog = (message) => {
    return {
        memberId: message.author.id,
        guildId: message.guild?.id || 'DM', // Handle direct messages gracefully
        channelId: message.channel?.id || 'DM',
        content: message.content || '[Non-text message]',
        attachments: message.attachments.map(att => att.url),
        timestamp: new Date().toISOString(),
    };
};

// Configure Winston logger
const logger = createLogger({
    level: process.env.RUN_MODE === 'production' ? 'info' : 'debug', // Use 'debug' in development, 'info' in production
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add timestamp
        format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`) // Format the log entry
    ),
    transports: [
        new transports.Console(), // Log to console
        new transports.File({ filename: 'logs/bot.log' }), // Log to file
    ],
});

// Helper function for logging Discord messages
const logMessage = async (message, level = 'verbose') => {
    const formattedMessage = formatLog(message);
    logger.log(level, JSON.stringify(formattedMessage));
    // transport to database table `message`
    await addMessage(message);
};

module.exports = {
    logger,
    logMessage,
};
