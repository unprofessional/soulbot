const { createProfileCanvas } = require('./profile_canvas.js');

const renderProfileCanvas = async (guildMember, channel) => {
    // Convert the canvas to a Buffer
    const buffer = await createProfileCanvas(guildMember);

    /**
     * Pull image and add it as a separate image/file
     */
    // console.log('>>>>> renderProfileCanvas > guildMember: ', guildMember);
    let files = [{
        attachment: buffer,
        name: 'image.png',
    }];

    // Create a MessageAttachment and send it
    await channel.send(
        {
            // content: `Media URLs found: ${mediaUrlsFormatted}`,
            files,
        }
    );
};

module.exports = {
    renderProfileCanvas,
};
