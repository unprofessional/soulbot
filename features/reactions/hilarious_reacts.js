const { getAllMemberRecords, getMemberRecord, upsertMemberRecord } = require('../../store/members.js');

const HILARIOUS_EMOJI_NAME = 'hilarious';
const HILARIOUS_METRIC_KEY = 'hilariousReacts';

function isHilariousReaction(reaction) {
    return reaction?.emoji?.name === HILARIOUS_EMOJI_NAME;
}

function isMilestone(total) {
    return total === 25 || total === 50 || (total >= 100 && total % 100 === 0);
}

function getHilariousEmojiDisplay(guild) {
    const emoji = guild?.emojis?.cache?.find((entry) => entry.name === HILARIOUS_EMOJI_NAME);
    return emoji?.toString?.() || `:${HILARIOUS_EMOJI_NAME}:`;
}

function cloneMetric(metric = {}) {
    return {
        receivedCount: Number(metric.receivedCount) || 0,
        reactedBy: metric.reactedBy && typeof metric.reactedBy === 'object'
            ? Object.fromEntries(
                Object.entries(metric.reactedBy).map(([memberId, messageIds]) => [
                    memberId,
                    Array.isArray(messageIds) ? [...messageIds] : [],
                ])
            )
            : {},
        milestonesAnnounced: Array.isArray(metric.milestonesAnnounced)
            ? [...metric.milestonesAnnounced]
            : [],
    };
}

function getGuildMetricContainer(meta = {}, guildId) {
    const guildMetrics = meta.guildMetrics && typeof meta.guildMetrics === 'object'
        ? meta.guildMetrics
        : {};
    const guildMetric = guildMetrics[guildId] && typeof guildMetrics[guildId] === 'object'
        ? guildMetrics[guildId]
        : {};

    return {
        guildMetrics,
        guildMetric,
        hilariousMetric: cloneMetric(guildMetric[HILARIOUS_METRIC_KEY]),
    };
}

async function recordHilariousReaction({ guildId, recipientUser, reactorId, messageId }) {
    if (!guildId || !recipientUser?.id || !reactorId || !messageId) {
        return {
            counted: false,
            reason: 'missing_fields',
        };
    }

    const existingMember = await getMemberRecord(recipientUser.id);
    const currentMeta = existingMember?.meta || {};
    const { guildMetrics, guildMetric, hilariousMetric } = getGuildMetricContainer(currentMeta, guildId);

    const priorMessageIds = Array.isArray(hilariousMetric.reactedBy[reactorId])
        ? hilariousMetric.reactedBy[reactorId]
        : [];

    if (priorMessageIds.includes(messageId)) {
        return {
            counted: false,
            reason: 'already_counted',
            total: hilariousMetric.receivedCount,
        };
    }

    const total = hilariousMetric.receivedCount + 1;
    const milestonesAnnounced = hilariousMetric.milestonesAnnounced.includes(total)
        ? hilariousMetric.milestonesAnnounced
        : (isMilestone(total)
            ? [...hilariousMetric.milestonesAnnounced, total]
            : hilariousMetric.milestonesAnnounced);

    const nextMeta = {
        ...currentMeta,
        guildMetrics: {
            ...guildMetrics,
            [guildId]: {
                ...guildMetric,
                [HILARIOUS_METRIC_KEY]: {
                    receivedCount: total,
                    reactedBy: {
                        ...hilariousMetric.reactedBy,
                        [reactorId]: [...priorMessageIds, messageId],
                    },
                    milestonesAnnounced,
                },
            },
        },
    };

    await upsertMemberRecord({
        memberId: recipientUser.id,
        prefix: existingMember?.prefix ?? null,
        meta: nextMeta,
    });

    return {
        counted: true,
        total,
        milestoneReached: isMilestone(total),
        displayName: recipientUser.globalName || recipientUser.username || recipientUser.id,
    };
}

async function getHilariousLeaderboard(guildId, limit = 10) {
    const members = await getAllMemberRecords();
    return members
        .map((member) => {
            const { hilariousMetric } = getGuildMetricContainer(member.meta || {}, guildId);
            return {
                memberId: member.memberId,
                total: hilariousMetric.receivedCount,
            };
        })
        .filter((member) => member.total > 0)
        .sort((a, b) => b.total - a.total || a.memberId.localeCompare(b.memberId))
        .slice(0, limit);
}

async function fetchPartialReactionContext(reaction) {
    const nextReaction = reaction?.partial ? await reaction.fetch() : reaction;
    const nextMessage = nextReaction?.message?.partial
        ? await nextReaction.message.fetch()
        : nextReaction?.message;

    return {
        reaction: nextReaction,
        message: nextMessage,
    };
}

async function handleHilariousReactionAdd(reaction, user) {
    if (user?.bot) return null;

    const { reaction: fullReaction, message } = await fetchPartialReactionContext(reaction);
    if (!isHilariousReaction(fullReaction)) return null;
    if (!message?.guildId || !message?.author || message.author.bot) return null;

    const result = await recordHilariousReaction({
        guildId: message.guildId,
        recipientUser: message.author,
        reactorId: user.id,
        messageId: message.id,
    });

    if (result?.milestoneReached && typeof message.channel?.send === 'function') {
        const emojiDisplay = fullReaction?.emoji?.toString?.() || getHilariousEmojiDisplay(message.guild);
        await message.channel.send(
            `${result.displayName} has received ${result.total} ${emojiDisplay} reacts!`
        );
    }

    return result;
}

module.exports = {
    HILARIOUS_EMOJI_NAME,
    handleHilariousReactionAdd,
    getHilariousEmojiDisplay,
    getHilariousLeaderboard,
    isMilestone,
    recordHilariousReaction,
};
