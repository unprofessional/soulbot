const { Events } = require('discord.js');

const {
    renderProfileCanvas,
} = require('../features/discord-profile/render_profile_canvas.js');

const initializeGuildMemberAdd = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberAdd, async (guildMember) => {

        const unprofessionals = client.guilds.cache.get('818606858780147712');

        // console.log('>>>> guildMemberAdd > unprofessionals: ', unprofessionals);

        if(unprofessionals) {
            const channel = client.channels.cache.get("917909802485678143");
            // console.log('>>> guildMember: ', guildMember);
            // channel.send(`\`${guildMember.user.username}\` joined the server!`);
            await renderProfileCanvas(guildMember, channel);
        }

    });

    return client;
};

module.exports = { initializeGuildMemberAdd };
