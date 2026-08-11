const { createProfileCanvas } = require('./profile_canvas.js');

const renderProfileCanvas = async (guildMember, channel, { content } = {}) => {
    // Convert the canvas to a Buffer
    const buffer = await createProfileCanvas(guildMember);

    /**
     * Pull image and add it as a separate image/file
     */
    // console.log('>>>>> renderProfileCanvas > guildMember: ', guildMember);
    const files = [{
        attachment: buffer,
        name: 'member-card.png',
    }];

    // Create a MessageAttachment and send it
    const payload = { files };
    if (content) {
        payload.content = content;
        payload.allowedMentions = {
            parse: [],
            users: [guildMember.user.id],
        };
    }

    await channel.send(payload);
};

module.exports = {
    renderProfileCanvas,
};
