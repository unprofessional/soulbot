const { createCanvas, loadImage } = require('canvas');

const CARD = Object.freeze({
    width: 960,
    height: 360,
    radius: 28,
    avatarX: 44,
    avatarY: 45,
    avatarSize: 270,
    contentX: 370,
    contentWidth: 520,
});

const FALLBACK_ACCENTS = Object.freeze([
    '#9B78FF',
    '#60E879',
    '#FF5964',
    '#4CC9F0',
    '#FFB84D',
    '#FF6EC7',
    '#6C7CFF',
    '#2DD4BF',
    '#FF7A45',
    '#A3E635',
    '#3B82F6',
    '#D946EF',
    '#FB7185',
    '#22D3EE',
    '#FACC15',
    '#C084FC',
]);
const FONT = 'Arial';

function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function hexToRgb(hex) {
    const value = hex.replace('#', '');
    const number = Number.parseInt(value, 16);
    return {
        r: (number >> 16) & 255,
        g: (number >> 8) & 255,
        b: number & 255,
    };
}

function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex, amount = 0.72) {
    const { r, g, b } = hexToRgb(hex);
    return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`;
}

function fallbackAccent(id = '') {
    const hash = [...String(id)].reduce((total, character) => total + character.charCodeAt(0), 0);
    return FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length];
}

function resolveAccent(guildMember) {
    const color = guildMember.displayColor;
    if (Number.isInteger(color) && color > 0) {
        return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
    }
    return fallbackAccent(guildMember.user?.id);
}

function resolveBadge(user) {
    if (user?.bot) return { type: 'bot', label: 'BOT', icon: 'bot' };

    const flags = user?.flags?.toArray?.() || [];
    const badge = [
        ['PremiumEarlySupporter', 'EARLY SUPPORTER', 'star'],
        ['HypeSquadOnlineHouse1', 'HYPESQUAD BRAVERY', 'shield'],
        ['HypeSquadOnlineHouse2', 'HYPESQUAD BRILLIANCE', 'shield'],
        ['HypeSquadOnlineHouse3', 'HYPESQUAD BALANCE', 'shield'],
        ['Hypesquad', 'HYPESQUAD', 'shield'],
        ['BugHunterLevel2', 'BUG HUNTER', 'diamond'],
        ['BugHunterLevel1', 'BUG HUNTER', 'diamond'],
        ['VerifiedDeveloper', 'VERIFIED DEVELOPER', 'diamond'],
        ['ActiveDeveloper', 'ACTIVE DEVELOPER', 'diamond'],
    ].find(([flag]) => flags.includes(flag));

    return badge ? { type: 'public', label: badge[1], icon: badge[2] } : null;
}

function formatMemberSince(date) {
    const validDate = date instanceof Date && !Number.isNaN(date.valueOf()) ? date : new Date();
    return `Member since ${new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/New_York',
    }).format(validDate)}`;
}

function memberCardDataFromGuildMember(guildMember) {
    const { user } = guildMember;
    const displayName = guildMember.displayName || user.globalName || user.username;
    const avatarUrl = user.displayAvatarURL?.({ extension: 'png', size: 512 }) || user.defaultAvatarURL;
    const avatarDecorationUrl = user.avatarDecorationURL?.({ extension: 'png', size: 512 }) || null;
    const accentColor = resolveAccent(guildMember);

    return {
        displayName,
        username: `@${user.username}`,
        avatarUrl,
        avatarDecorationUrl,
        memberSince: user.createdAt,
        memberSinceLabel: formatMemberSince(user.createdAt),
        badge: resolveBadge(user),
        accentColor,
        accentColorDark: darken(accentColor),
        backgroundDecoration: user.bot ? 'geometric' : 'stars',
    };
}

function fitText(ctx, text, maxWidth, fontSize, weight = 'normal') {
    ctx.font = `${weight} ${fontSize}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
        result = result.slice(0, -1);
    }
    return `${result}…`;
}

function drawBackgroundDecorations(ctx, data) {
    ctx.save();
    ctx.fillStyle = rgba(data.accentColor, 0.1);
    ctx.strokeStyle = rgba(data.accentColor, 0.12);
    ctx.lineWidth = 2;

    if (data.backgroundDecoration === 'geometric') {
        for (let index = 0; index < 8; index += 1) {
            const x = 520 + ((index * 107) % 390);
            const y = 38 + ((index * 71) % 280);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(index * 0.31);
            ctx.strokeRect(-10, -10, 20, 20);
            ctx.restore();
        }
    } else {
        for (let index = 0; index < 18; index += 1) {
            const x = 335 + ((index * 83) % 590);
            const y = 24 + ((index * 53) % 310);
            const size = index % 4 === 0 ? 5 : 2;
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size, y);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();
}

function drawCalendar(ctx, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    roundedRect(ctx, x, y, 30, 28, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 9);
    ctx.lineTo(x + 30, y + 9);
    ctx.moveTo(x + 8, y - 4);
    ctx.lineTo(x + 8, y + 5);
    ctx.moveTo(x + 22, y - 4);
    ctx.lineTo(x + 22, y + 5);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(x + 7, y + 15, 4, 4);
    ctx.fillRect(x + 18, y + 15, 4, 4);
    ctx.restore();
}

function drawBadgeIcon(ctx, x, y, icon) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    if (icon === 'bot') {
        roundedRect(ctx, x, y + 4, 28, 21, 6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 14, y + 4);
        ctx.lineTo(x + 14, y - 2);
        ctx.stroke();
        ctx.fillStyle = '#11131B';
        ctx.beginPath();
        ctx.arc(x + 9, y + 14, 2.5, 0, Math.PI * 2);
        ctx.arc(x + 19, y + 14, 2.5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        for (let point = 0; point < 10; point += 1) {
            const radius = point % 2 === 0 ? 14 : 6;
            const angle = -Math.PI / 2 + point * Math.PI / 5;
            const px = x + 14 + Math.cos(angle) * radius;
            const py = y + 13 + Math.sin(angle) * radius;
            if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

async function drawAvatar(ctx, data) {
    const centerX = CARD.avatarX + CARD.avatarSize / 2;
    const centerY = CARD.avatarY + CARD.avatarSize / 2;
    const radius = CARD.avatarSize / 2;

    ctx.save();
    ctx.shadowColor = data.accentColor;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = rgba(data.accentColor, 0.75);
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(data.avatarUrl);
        const scale = Math.max(CARD.avatarSize / avatar.width, CARD.avatarSize / avatar.height);
        const width = avatar.width * scale;
        const height = avatar.height * scale;
        ctx.drawImage(avatar, centerX - width / 2, centerY - height / 2, width, height);
    } catch (error) {
        const fallback = ctx.createLinearGradient(CARD.avatarX, CARD.avatarY, centerX + radius, centerY + radius);
        fallback.addColorStop(0, data.accentColor);
        fallback.addColorStop(1, data.accentColorDark);
        ctx.fillStyle = fallback;
        ctx.fillRect(CARD.avatarX, CARD.avatarY, CARD.avatarSize, CARD.avatarSize);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold 108px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(data.displayName.trim().charAt(0).toUpperCase() || '?', centerX, centerY + 6);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();

    ctx.strokeStyle = data.accentColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (data.avatarDecorationUrl) {
        try {
            const decoration = await loadImage(data.avatarDecorationUrl);
            ctx.drawImage(decoration, CARD.avatarX - 20, CARD.avatarY - 20, CARD.avatarSize + 40, CARD.avatarSize + 40);
        } catch (error) {
            console.warn('Avatar decoration could not load:', error.message);
        }
    }
}

async function createMemberCard(data) {
    const canvas = createCanvas(CARD.width, CARD.height);
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CARD.width, CARD.height);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 24;
    roundedRect(ctx, 10, 10, 940, 340, CARD.radius);
    ctx.fillStyle = '#0D0E15';
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, 10, 10, 940, 340, CARD.radius);
    ctx.clip();
    const background = ctx.createLinearGradient(50, 20, 940, 340);
    background.addColorStop(0, data.accentColorDark);
    background.addColorStop(0.56, '#11121B');
    background.addColorStop(1, rgba(data.accentColor, 0.2));
    ctx.fillStyle = background;
    ctx.fillRect(10, 10, 940, 340);
    drawBackgroundDecorations(ctx, data);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = data.accentColor;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = rgba(data.accentColor, 0.78);
    ctx.lineWidth = 3;
    roundedRect(ctx, 10, 10, 940, 340, CARD.radius);
    ctx.stroke();
    ctx.restore();

    await drawAvatar(ctx, data);

    const x = CARD.contentX;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 58px ${FONT}`;
    ctx.fillText(fitText(ctx, data.displayName, CARD.contentWidth, 58, 'bold'), x, 100);
    ctx.fillStyle = data.accentColor;
    ctx.font = `34px ${FONT}`;
    ctx.fillText(fitText(ctx, data.username, CARD.contentWidth, 34), x, 151);

    const divider = ctx.createLinearGradient(x, 0, x + CARD.contentWidth, 0);
    divider.addColorStop(0, rgba(data.accentColor, 0.95));
    divider.addColorStop(1, rgba(data.accentColor, 0));
    ctx.fillStyle = divider;
    ctx.fillRect(x, 178, CARD.contentWidth, 2);

    drawCalendar(ctx, x + 2, 207, data.accentColor);
    ctx.fillStyle = '#D4D5DE';
    ctx.font = `25px ${FONT}`;
    ctx.fillText(fitText(ctx, data.memberSinceLabel, CARD.contentWidth - 52, 25), x + 52, 233);

    if (data.badge) {
        ctx.font = `bold 22px ${FONT}`;
        const badgeWidth = Math.min(CARD.contentWidth, ctx.measureText(data.badge.label).width + 86);
        const badgeGradient = ctx.createLinearGradient(x, 0, x + badgeWidth, 0);
        badgeGradient.addColorStop(0, rgba(data.accentColor, 0.8));
        badgeGradient.addColorStop(1, rgba(data.accentColor, 0.32));
        roundedRect(ctx, x, 264, badgeWidth, 54, 27);
        ctx.fillStyle = badgeGradient;
        ctx.fill();
        ctx.strokeStyle = rgba(data.accentColor, 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
        drawBadgeIcon(ctx, x + 18, 278, data.badge.icon);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(data.badge.label, x + 61, 299);
    }

    return canvas.toBuffer('image/png');
}

async function createProfileCanvas(guildMember) {
    return createMemberCard(memberCardDataFromGuildMember(guildMember));
}

module.exports = {
    CARD,
    FALLBACK_ACCENTS,
    createMemberCard,
    createProfileCanvas,
    fallbackAccent,
    formatMemberSince,
    memberCardDataFromGuildMember,
    resolveBadge,
};
