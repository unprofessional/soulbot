const { Events } = require('discord.js');

const {
    renderProfileCanvas,
} = require('../features/render_profile_canvas.js');

const initializeGuildMemberAdd = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberAdd, async (guildMember) => {
        const channel = client.channels.cache.get("1170400835763707946");
        console.log('>>> guildMember: ', guildMember);
        // channel.send(`\`${guildMember.user.username}\` joined the server!`);
        await renderProfileCanvas(guildMember, channel);
    });

    return client;
};

module.exports = { initializeGuildMemberAdd };
