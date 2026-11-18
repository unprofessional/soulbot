const { randomBytes } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
class Sessions {
    constructor({ now = Date.now, ttl = 120000, limit = 2000 } = {}) {
        this.items = new Map(); this.now = now; this.ttl = ttl; this.limit = limit;
    }
    create(owner, payload) {
        for (const [id, item] of this.items) if (item.expires <= this.now()) this.items.delete(id);
        while (this.items.size >= this.limit) this.items.delete(this.items.keys().next().value);
        const id = randomBytes(16).toString('hex');
        this.items.set(id, { ...owner, payload, expires: this.now() + this.ttl, busy: false });
        return `counting:${id}`;
    }
    claim(customId, owner) {
        const id = customId.slice('counting:'.length);
        const item = this.items.get(id);
        if (!item || item.expires <= this.now()) { this.items.delete(id); return { error: 'This control expired. Reopen /counting help or run the command again.' }; }
        if (item.userId !== owner.userId || item.guildId !== owner.guildId || item.originChannelId !== owner.originChannelId) return { error: 'This control belongs to another member or channel. Open /counting help for your own view.' };
        if (item.busy) return { error: 'This action is already being processed.' };
        item.busy = true;
        return { id, item };
    }
    consume(id) { this.items.delete(id); }
}
const sessions = new Sessions();
const ownerOf = i => ({ userId: i.user.id, guildId: i.guildId, originChannelId: i.channelId || i.channel?.id });
function button(i, label, payload, style = ButtonStyle.Secondary) {
    return new ButtonBuilder().setCustomId(sessions.create(ownerOf(i), payload)).setLabel(label).setStyle(style);
}
function row(...buttons) { return new ActionRowBuilder().addComponents(buttons); }
module.exports = { Sessions, sessions, ownerOf, button, row, ButtonStyle };
