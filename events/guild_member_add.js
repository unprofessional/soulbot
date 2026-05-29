const { Events } = require('discord.js');

const {
    renderProfileCanvas,
} = require('../features/discord-profile/render_profile_canvas.js');
const { resolveGreetingChannel } = require('./guild_greeting_utils.js');

const initializeGuildMemberAdd = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberAdd, async (guildMember) => {
        const channel = await resolveGreetingChannel(guildMember.guild);
        if (!channel) {
            return;
        }

        await renderProfileCanvas(guildMember, channel);
    });

    return client;
};

module.exports = { initializeGuildMemberAdd };
