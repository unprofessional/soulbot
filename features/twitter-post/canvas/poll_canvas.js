// features/twitter-post/canvas/poll_canvas.js

const { getWrappedText } = require('../../twitter-core/canvas/text_wrap');
const { TEXT_FONT_FAMILY } = require('./constants');

const POLL_LABEL_FONT = `bold 18px ${TEXT_FONT_FAMILY}`;
const POLL_META_FONT = `16px ${TEXT_FONT_FAMILY}`;
const POLL_OPTION_GAP = 12;
const POLL_OPTION_MIN_HEIGHT = 42;
const POLL_BAR_HEIGHT = 18;
const POLL_BAR_RADIUS = 9;
const POLL_TOP_PAD = 4;
const POLL_BOTTOM_PAD = 30;
const POLL_LABEL_TO_BAR_GAP = 8;
const POLL_META_TOP_GAP = 16;

function isRenderablePoll(pollData) {
    return Boolean(
        pollData &&
        typeof pollData === 'object' &&
        Array.isArray(pollData.options) &&
        pollData.options.length > 0
    );
}

function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0%';
    const rounded = Math.round(number * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatVotes(count) {
    const number = Number(count);
    if (!Number.isFinite(number) || number <= 0) return '';
    const label = number === 1 ? 'vote' : 'votes';
    return `${new Intl.NumberFormat('en-US').format(number)} ${label}`;
}

function getOptionPercent(option, totalVotes) {
    const percent = Number(option?.percent);
    if (Number.isFinite(percent)) return Math.max(0, Math.min(100, percent));

    const votes = Number(option?.votes);
    if (Number.isFinite(votes) && Number.isFinite(totalVotes) && totalVotes > 0) {
        return Math.max(0, Math.min(100, (votes / totalVotes) * 100));
    }

    return 0;
}

function getTotalVotes(pollData) {
    const explicitTotal = Number(pollData?.totalVotes);
    if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal;

    return pollData.options.reduce((sum, option) => {
        const votes = Number(option?.votes);
        return sum + (Number.isFinite(votes) ? votes : 0);
    }, 0);
}

function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function getPollOptionLayouts(ctx, pollData, width) {
    if (!isRenderablePoll(pollData)) return [];

    const totalVotes = getTotalVotes(pollData);
    const percentColumnWidth = 72;
    const labelWidth = Math.max(1, width - percentColumnWidth - 14);

    ctx.font = POLL_LABEL_FONT;

    return pollData.options.map((option) => {
        const labelLines = getWrappedText(ctx, option.name || '', labelWidth, { preserveEmptyLines: false });
        const lineCount = Math.max(1, Math.min(2, labelLines.length));
        const visibleLabelLines = labelLines.slice(0, lineCount);
        if (labelLines.length > visibleLabelLines.length) {
            const lastIndex = visibleLabelLines.length - 1;
            visibleLabelLines[lastIndex] = `${visibleLabelLines[lastIndex].replace(/[.…]+$/u, '')}...`;
        }

        const labelHeight = lineCount * 21;
        const height = Math.max(
            POLL_OPTION_MIN_HEIGHT,
            labelHeight + POLL_LABEL_TO_BAR_GAP + POLL_BAR_HEIGHT
        );

        return {
            option,
            labelLines: visibleLabelLines,
            height,
            percent: getOptionPercent(option, totalVotes),
        };
    });
}

function measurePollHeight(ctx, pollData, width) {
    if (!isRenderablePoll(pollData)) return 0;

    const optionHeight = getPollOptionLayouts(ctx, pollData, width)
        .reduce((sum, option, index) => sum + option.height + (index > 0 ? POLL_OPTION_GAP : 0), 0);

    return POLL_TOP_PAD + optionHeight + POLL_META_TOP_GAP + 20 + POLL_BOTTOM_PAD;
}

function drawPoll(ctx, pollData, x, y, width) {
    if (!isRenderablePoll(pollData)) return;

    const totalVotes = getTotalVotes(pollData);
    const optionLayouts = getPollOptionLayouts(ctx, pollData, width);
    const percentColumnWidth = 72;
    const labelWidth = Math.max(1, width - percentColumnWidth - 14);
    let cursorY = y + POLL_TOP_PAD;

    for (const layout of optionLayouts) {
        ctx.font = POLL_LABEL_FONT;
        ctx.fillStyle = '#f7f9f9';

        let labelY = cursorY + 17;
        for (const line of layout.labelLines) {
            ctx.fillText(line, x, labelY);
            labelY += 21;
        }

        ctx.font = POLL_LABEL_FONT;
        ctx.fillStyle = '#f7f9f9';
        const percentText = formatPercent(layout.percent);
        const percentWidth = ctx.measureText(percentText).width;
        ctx.fillText(percentText, x + width - percentWidth, cursorY + 17);

        const barY = cursorY + Math.max(24, layout.labelLines.length * 21 + POLL_LABEL_TO_BAR_GAP);
        const barWidth = width;
        roundedRect(ctx, x, barY, barWidth, POLL_BAR_HEIGHT, POLL_BAR_RADIUS);
        ctx.fillStyle = '#202327';
        ctx.fill();

        const fillWidth = Math.max(POLL_BAR_HEIGHT, Math.round(barWidth * (layout.percent / 100)));
        roundedRect(ctx, x, barY, Math.min(barWidth, fillWidth), POLL_BAR_HEIGHT, POLL_BAR_RADIUS);
        ctx.fillStyle = '#1d9bf0';
        ctx.fill();

        const voteText = formatVotes(layout.option.votes);
        if (voteText) {
            ctx.font = POLL_META_FONT;
            ctx.fillStyle = '#e7e9ea';
            const voteWidth = ctx.measureText(voteText).width;
            ctx.fillText(voteText, x + Math.min(labelWidth, Math.max(0, barWidth - voteWidth - 10)), barY + 14);
        }

        cursorY += layout.height + POLL_OPTION_GAP;
    }

    const totalText = formatVotes(totalVotes);
    if (totalText) {
        ctx.font = POLL_META_FONT;
        ctx.fillStyle = '#71767b';
        ctx.fillText(totalText, x, cursorY + POLL_META_TOP_GAP);
    }
}

module.exports = {
    drawPoll,
    formatPercent,
    formatVotes,
    getTotalVotes,
    isRenderablePoll,
    measurePollHeight,
};
