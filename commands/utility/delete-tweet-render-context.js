const {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
} = require('discord.js');
const { deleteTrackedTweetRender } = require('./delete-tweet-render.js');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Delete tweet render')
        .setType(ApplicationCommandType.Message),

    async execute(interaction) {
        const targetMessage = interaction.targetMessage;

        if (!targetMessage?.id) {
            return interaction.reply({
                content: 'I could not resolve the selected message.',
                ephemeral: true,
            });
        }

        return deleteTrackedTweetRender(interaction, {
            parsedTarget: {
                type: 'discord_message',
                guildId: interaction.guildId,
                channelId: targetMessage.channelId || interaction.channelId,
                messageId: targetMessage.id,
            },
            notFoundMessage: 'That selected message is not a tracked tweet render.',
        });
    },
};
