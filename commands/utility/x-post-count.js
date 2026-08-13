const { SlashCommandBuilder } = require('discord.js');
const {
    countSuccessfulTwitterRendersByUser,
} = require('../../store/services/messages.service.js');

const PERIODS = Object.freeze({
    '24h': { durationMs: 24 * 60 * 60 * 1000, label: 'past 24 hours' },
    '5d': { durationMs: 5 * 24 * 60 * 60 * 1000, label: 'past 5 days' },
    '7d': { durationMs: 7 * 24 * 60 * 60 * 1000, label: 'past 7 days' },
});

function resolvePeriod(value) {
    return PERIODS[value] || PERIODS['24h'];
}

function formatCount(count) {
    return `${count} X post${count === 1 ? '' : 's'}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('x-post-count')
        .setDescription('Show how many X posts Soulbot recently rendered for a user.')
        .setDMPermission(false)
        .addUserOption(option => option
            .setName('user')
            .setDescription('The user to count; defaults to you.')
            .setRequired(false))
        .addStringOption(option => option
            .setName('period')
            .setDescription('The rolling time period to count.')
            .setRequired(false)
            .addChoices(
                { name: '24 hours', value: '24h' },
                { name: '5 days', value: '5d' },
                { name: '7 days', value: '7d' }
            )),

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const period = resolvePeriod(interaction.options.getString('period'));
        const createdSince = new Date(Date.now() - period.durationMs);

        await interaction.deferReply();
        const count = await countSuccessfulTwitterRendersByUser({
            userId: user.id,
            createdSince,
        });

        return interaction.editReply({
            content: `<@${user.id}> had ${formatCount(count)} rendered by Soulbot in the ${period.label}.`,
            allowedMentions: { parse: [] },
        });
    },

    PERIODS,
    formatCount,
    resolvePeriod,
};
