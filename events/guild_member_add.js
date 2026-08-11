const { Events } = require('discord.js');

const {
    renderProfileCanvas,
} = require('../features/discord-profile/render_profile_canvas.js');
const { resolveGreetingChannel } = require('./guild_greeting_utils.js');
const { recordMemberEntry } = require('../store/member_events.js');

function ordinal(value) {
    const number = Math.max(1, Number(value) || 1);
    const remainder100 = number % 100;
    if (remainder100 >= 11 && remainder100 <= 13) return `${number}th`;

    const suffix = {
        1: 'st',
        2: 'nd',
        3: 'rd',
    }[number % 10] || 'th';
    return `${number}${suffix}`;
}

function buildWelcomeContent(guildMember, joinCount = 1) {
    const welcome = `Welcome <@${guildMember.user.id}>`;
    if (joinCount <= 1) return welcome;
    return `${welcome}\nThis is the ${ordinal(joinCount)} time you've joined this server.`;
}

const initializeGuildMemberAdd = (client) => {
    // "guildMemberAdd"
    client.on(Events.GuildMemberAdd, async (guildMember) => {
        let joinCount = 1;
        try {
            joinCount = await recordMemberEntry(guildMember);
        } catch (error) {
            console.error('[member-events] Failed to record member entry:', error);
        }

        const channel = await resolveGreetingChannel(guildMember.guild);
        if (!channel) {
            return;
        }

        await renderProfileCanvas(guildMember, channel, {
            content: buildWelcomeContent(guildMember, joinCount),
        });
    });

    return client;
};

module.exports = {
    buildWelcomeContent,
    initializeGuildMemberAdd,
    ordinal,
};
