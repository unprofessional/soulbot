const { randomBytes } = require('node:crypto');
const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const service = require('./service.js');
const { refresh, target, canRead } = require('./permissions.js');
const copy = require('./presentation.js');
const { buildView } = require('./views.js');
const { snapshot } = require('../../store/dao/counting.dao.js');
const { sessions, ownerOf, button, row, ButtonStyle } = require('./sessions.js');
const READ = new Set(['help', 'current', 'settings', 'status', 'leaderboard', 'top']);
function userError(message) { return Object.assign(new Error(message), { userFacing: true }); }
function payload(text, components = []) {
    // Embeds keep mobile responses scannable without exceeding Discord's 2,000-character message limit.
    const chunks = []; let current = '';
    for (const line of text.split('\n')) {
        if (current.length + line.length > 3800) { chunks.push({ description: current }); current = ''; }
        current += `${line}\n`;
    }
    if (current) chunks.push({ description: current.trimEnd() });
    return { content: '', embeds: chunks, components, allowedMentions: { parse: [] } };
}
function nav(i, channelId) {
    const links = [['Find teams', 'help'], ['Next number', 'current'], ['Rules', 'settings'], ['Teams', 'leaderboard'], ['Contributors', 'top']];
    return row(...links.filter(([, action]) => channelId || ['help', 'leaderboard'].includes(action)).map(([label, action]) => button(i, label, { action, channelId })));
}
function manager(context) { return context.viewer.permissions.has(P.ManageGuild); }
async function contextFor(i) { return refresh(i.guild, i.user.id); }
async function help(i, params = {}) {
    let context, games, unavailable = false;
    const requested = params.page || 1;
    try {
        context = await contextFor(i);
        if (!service.isAvailable()) throw Error('Counting unavailable');
        const visible = [...context.channels.values()].filter(c => canRead(c, context.viewer, i.guildId)).map(c => c.id);
        games = await service.dao.list(i.guildId, visible);
    } catch (error) { unavailable = true; console.error('[counting] Help discovery unavailable:', error.message); }
    const isManager = context ? manager(context) : Boolean(i.memberPermissions?.has(P.ManageGuild));
    const pages = Math.max(1, Math.ceil((games?.length || 0) / 5));
    const page = Math.min(Math.max(1, requested), pages);
    const selected = games?.slice((page - 1) * 5, page * 5) || [];
    const entries = selected.map(game => {
        const channel = context.channels.get(game.channel_id);
        return `**<#${channel.id}> · ${copy.roleLabel(game, context.roles)}**\n${copy.participation(game, channel, i.guild, context.roles, context.viewer, service.connected(i.guildId, channel.id))}\n${copy.example('current', channel.id)}`;
    });
    let text = `**Your counting channels**\n${unavailable ? 'Channel list temporarily unavailable. Retry /counting help; managers can check /counting status.' : entries.join('\n\n') || 'No counting channels are available to you. Ask a server manager, or use the setup steps below if you manage this server.'}`;
    if (!unavailable) text += `\n${requested > pages ? `Page ${requested} is unavailable; showing last page. ` : ''}Page ${page}/${pages}.${page < pages ? ` Next: /counting help page:${page + 1}.` : ''}${page > 1 ? ` Previous: /counting help page:${page - 1}.` : ''}`;
    text += '\n\n**How to play**\nCount together: 1, 2, 3… Post only the next number. ✅ means accepted. Your channel’s rules decide whether teammates take turns and whether mistakes restart the count. Use /counting current before posting; /counting settings explains active rules. Offline posts may be missed.';
    const channelId = params.channelId;
    if (channelId && context) {
        const game = games?.find(g => g.channel_id === channelId);
        if (game) text += `\n\n**Selected channel: <#${channelId}>**\n${copy.rules(game)}`;
        else if (!canRead(context.channels.get(channelId), context.viewer, i.guildId)) text += '\nThe requested channel is not available to you.';
    }
    if (isManager) text += `\n\n${copy.managerSteps}`;
    const controls = [nav(i, null)];
    if (selected.length) controls.push(row(...selected.map(game => button(i, `Next: #${copy.safe(context.channels.get(game.channel_id).name || game.channel_id)}`.slice(0, 40), { action: 'current', channelId: game.channel_id }))));
    if (!unavailable && pages > 1) controls.push(row(
        button(i, 'Previous teams', { action: 'help', page: page - 1 }, ButtonStyle.Secondary).setDisabled(page <= 1),
        button(i, 'Next teams', { action: 'help', page: page + 1 }).setDisabled(page >= pages),
    ));
    return i.editReply(payload(text, controls));
}
async function read(i, action, params, context) {
    const channelId = params.channelId || i.channelId || i.channel?.id;
    if (['leaderboard', 'top'].includes(action)) {
        const view = await buildView(i, context.viewer, action, { ...params, channelId });
        const controls = [nav(i, action === 'top' || params.channelId ? channelId : null)];
        controls.push(row(
            button(i, 'Previous page', { ...params, action, channelId, page: Math.max(1, view.page - 1) }).setDisabled(view.page <= 1 || view.page > view.pages),
            button(i, view.page > view.pages ? 'Last valid page' : 'Next page', { ...params, action, channelId, page: view.page > view.pages ? view.pages : view.page + 1 }).setDisabled(view.page === view.pages),
            ...(action === 'top' ? [button(i, view.scope === 'run' ? 'All team history' : 'Since restart at 1', { action, channelId, page: 1, scope: view.scope === 'run' ? 'lifetime' : 'run' })] : []),
        ));
        return i.editReply(payload(view.content, controls));
    }
    const channel = target(context, i.guildId, channelId);
    const game = await service.dao.get(i.guildId, channel.id);
    if (!game) return i.editReply(payload(`**<#${channel.id}> has no counting game.**\n${manager(context) ? 'Open this channel and run /counting setup role:… after preparing its team role and access.' : 'Use /counting help to find a team, or ask a server manager to set one up.'}`, [nav(i, null)]));
    const controls = [nav(i, channel.id)];
    if (manager(context) && game.state !== 'retired') controls.push(row(button(i, 'Post channel guide', { action: 'guide', channelId: channel.id })));
    return i.editReply(payload(copy.readView(action, game, channel, i.guild, context, service.connected(i.guildId, channel.id), service.getNotices()?.status(i.guildId, channel.id)), controls));
}
function preview(i, action, channel, game, options, roleId) {
    let description;
    if (action === 'setup') description = `**Start counting in <#${channel.id}> for <@&${roleId}>?**\nStart at **1**. Teammates take turns. Wrong numbers keep progress. Change rules later with /counting configure.\nMembers need that role already; setup does not assign it or change channel access. Only counting posts belong here while active; invalid posts are removed when Soulbot has permission.`;
    else if (action === 'reset') description = `**Restart <#${channel.id}> at 1?**\nLast: ${game.current_count}. Best ${game.record} and all accepted contributions for this team history are preserved. The current run and last-turn restriction are cleared.`;
    else if (action === 'retire') description = `**Retire <#${channel.id}>?**\nRemove it from team standings and allow normal chat. Saved progress and contribution history remain. A manager can use ${copy.example('resume', channel.id)} to reactivate it.`;
    else description = `**Change rules/team in <#${channel.id}>?**\n${options.roleId && options.roleId !== game.role_id ? `Team becomes <@&${options.roleId}>. ${options.history === 'reset' ? 'Start at 1 with a fresh best count and fresh contributor totals; old history stays archived.' : 'Keep progress, best count, and contributor totals; past activity is credited to the new team.'}\n` : ''}${copy.rules({ ...game, mistake_policy: options.policy ?? game.mistake_policy, allow_consecutive: options.consecutive ?? game.allow_consecutive })}\nOmitted settings stay unchanged.`;
    const group = { used: false };
    const data = { action: 'confirm', managementAction: action, channelId: channel.id, options, expected: snapshot(game), group };
    return i.editReply(payload(`${description}\nConfirm within two minutes or cancel.`, [row(
        button(i, action === 'setup' ? 'Start counting' : 'Confirm change', data, action === 'reset' || action === 'retire' ? ButtonStyle.Danger : ButtonStyle.Primary),
        button(i, 'Cancel', { action: 'cancel', group }),
    )]));
}
async function validate(guild, channel, roleId) {
    try { await service.validateTarget(guild, channel, roleId); }
    catch (error) {
        if (!error.code) throw userError(error.message);
        throw error;
    }
}
async function manage(i, action, params, context) {
    if (!manager(context)) throw userError('You need Manage Server to manage games. Use /counting help to find a team you can play in.');
    const channelId = action === 'setup' ? (i.channelId || i.channel?.id) : params.channelId || i.channelId || i.channel?.id;
    if (action === 'setup' && context.channels.get(channelId)?.type !== ChannelType.GuildText) throw userError('Open the text channel you want to use, then run /counting setup role:…');
    const channel = target(context, i.guildId, channelId);
    const game = await service.dao.get(i.guildId, channel.id);
    if (action === 'guide') {
        if (!game || game.state === 'retired') throw userError('No active counting game here. Use /counting help to set one up or resume it.');
        // No mutation can be replayed if Discord acknowledges the send but the UI reply fails.
        await service.serial(`${i.guildId}:${channel.id}`, async () => {
            const current = await service.dao.get(i.guildId, channel.id);
            if (!current || current.state === 'retired') throw userError('The game changed. Reopen /counting settings.');
            try { await channel.send({ content: copy.guide(current, context.roles), allowedMentions: { parse: [] } }); }
            catch { throw userError('Game is saved; the guide could not be confirmed as posted. Check the channel before retrying Post channel guide from /counting settings.'); }
        });
        return i.editReply(payload(`Guide posted in <#${channel.id}>. Next: have teammates check /counting current.`, [nav(i, channel.id)]));
    }
    const options = params.options || {};
    if (action === 'setup') {
        if (game) return i.editReply(payload(`**<#${channel.id}> already has a ${copy.stateLabel(game.state).toLowerCase()} game.**\nUse ${copy.example('configure', channel.id)} to edit it${game.state !== 'active' ? `, or ${copy.example('resume', channel.id)} to continue` : ''}. Setup never replaces existing progress.`, [nav(i, channel.id)]));
        if (!options.roleId || !context.roles.has(options.roleId)) throw userError('Choose an existing team role. Create it and assign teammates in Discord, then run /counting setup role:… here.');
        await validate(i.guild, channel, options.roleId);
        return preview(i, action, channel, null, { roleId: options.roleId }, options.roleId);
    }
    if (!game) throw userError('No game here. Open this channel and use /counting setup role:…; /counting help has preparation steps.');
    if (action === 'configure') {
        const changes = options.roleId || options.policy || options.consecutive != null;
        const roleChange = options.roleId && options.roleId !== game.role_id;
        if (options.history && !roleChange) throw userError('History is only used when changing the team role. Omit history to change rules.');
        if (roleChange && !options.history) throw userError('Changing teams needs history:retain to credit past activity to the new team, or history:reset to start fresh and archive it. Run /counting configure again with that choice.');
        if (!changes) return read(i, 'configure', { channelId }, context);
        await validate(i.guild, channel, options.roleId || game.role_id);
        return preview(i, action, channel, game, options);
    }
    if (['reset', 'retire'].includes(action)) return preview(i, action, channel, game, {});
    if (action === 'resume') await validate(i.guild, channel, game.role_id);
    await service.serial(`${i.guildId}:${channel.id}`, () => service.dao.manage(i.guildId, channel.id, i.user.id, action, action === 'pause' ? {} : { expected: snapshot(game) }));
    const current = await service.dao.get(i.guildId, channel.id);
    service.getNotices()?.remember(current);
    return i.editReply(payload(`**<#${channel.id}> ${action === 'pause' ? 'paused; progress saved' : 'resumed'}.**\n${action === 'pause' ? `Next: ${copy.example('resume', channel.id)} when ready.` : `${copy.rules(current)}\nNext: ${copy.example('current', channel.id)} to check the saved next number and turn.`}`, [nav(i, channel.id)]));
}
async function confirm(i, data, context) {
    if (!manager(context)) throw userError('You need Manage Server to confirm this action.');
    const channel = target(context, i.guildId, data.channelId);
    if (['setup', 'configure', 'resume'].includes(data.managementAction)) await validate(i.guild, channel, data.options.roleId || data.expected?.role_id);
    try {
        await service.serial(`${i.guildId}:${channel.id}`, () => service.dao.manage(i.guildId, channel.id, i.user.id, data.managementAction, {
            ...data.options, ...(data.managementAction === 'setup' ? { roleId: data.options.roleId, policy: 'reject', consecutive: false } : {}), expected: data.expected,
        }));
    } catch (error) {
        if (error.code !== 'COUNTING_STALE') throw error;
        const current = await service.dao.get(i.guildId, channel.id);
        if (data.managementAction === 'setup' || !current) throw userError('The game changed; nothing was changed by this confirmation. Reopen /counting settings or run setup again.');
        await preview(i, data.managementAction, channel, current, data.options);
        return i.followUp({ content: 'Progress or rules changed since your preview. Review it and confirm again. For a busy game, pause it first, then rerun the change.', ephemeral: true, allowedMentions: { parse: [] } });
    }
    const game = await service.dao.get(i.guildId, channel.id);
    service.getNotices()?.remember(game);
    const controls = [nav(i, channel.id)];
    if (game.state !== 'retired') controls.push(row(button(i, 'Post channel guide', { action: 'guide', channelId: channel.id })));
    const text = data.managementAction === 'setup'
        ? `**<#${channel.id}> is ready for ${copy.roleLabel(game, context.roles)}.**\n${game.current_count === 0 ? 'One teammate posts **1**, a different teammate posts **2**.' : `Counting already started. Last: **${game.current_count}**; check /counting current for the next number.`}\n${copy.rules(game)} Change rules later with /counting configure.\nMembers need the team role and send access; setup did not assign roles or change permissions.\nNext: check /counting status and member access, then Post channel guide.`
        : `**<#${channel.id}> updated: ${copy.stateLabel(game.state)}.**\n${data.managementAction === 'retire' ? `History preserved; normal chat is allowed. Next: ${copy.example('resume', channel.id)} to reactivate.` : `${copy.rules(game)}\nLast: ${game.current_count} · Next: ${copy.next(game)} · Best: ${game.record}.\nNext: ${copy.example('current', channel.id)} before posting.`}`;
    return i.editReply(payload(text, controls));
}
async function dispatch(i, action, params = {}) {
    if (action === 'help') return help(i, params);
    if (!service.isAvailable()) throw userError('Counting is temporarily unavailable. Your saved progress is not reset. Use /counting help; ask a manager to check bot status.');
    const context = await contextFor(i);
    if (READ.has(action)) return read(i, action, params, context);
    if (action === 'confirm') return confirm(i, params, context);
    return manage(i, action, params, context);
}
async function errorReply(i, error, action) {
    const ref = randomBytes(4).toString('hex');
    console.error(`[counting UI ${ref}]`, error);
    let text = error.userFacing ? error.message : `Could not complete this action. Saved progress may have changed; check /counting current before trying again. Ask a manager for help (reference ${ref}).`;
    if (!error.userFacing && READ.has(action)) text = `${['top', 'leaderboard'].includes(action) ? 'Rankings are temporarily unavailable; core counting is separate.' : 'Could not load this view.'} Retry /counting help, or ask a manager for help (reference ${ref}).`;
    if (error.code === 'COUNTING_STALE') text = 'The game changed before this action. Nothing was changed by this request. Run the command again for its latest state.';
    if (error.code === '23505') text = 'That role or channel already has a counting game. Use /counting help for visible games; configure or retire the old assignment before creating another.';
    return i.editReply(payload(text, [nav(i, null)]));
}
async function execute(i) {
    if (!i.guildId) return i.reply({ content: 'Use /counting help in a server.', ephemeral: true });
    await i.deferReply({ ephemeral: true });
    let action;
    try {
        action = i.options.getSubcommand();
        const options = {};
        if (action === 'setup') {
            const supplied = i.options.data?.[0]?.options || [];
            if (supplied.some(o => o.name !== 'role')) throw userError('Setup is simpler now. Open the target text channel and run /counting setup role:… (one role option).');
            options.roleId = i.options.getRole('role', true)?.id;
        } else if (action === 'configure') {
            options.roleId = i.options.getRole('role')?.id;
            options.policy = i.options.getString('mistakes');
            options.consecutive = i.options.getBoolean('consecutive');
            options.history = i.options.getString('history');
        }
        return await dispatch(i, action, {
            channelId: action === 'setup' ? i.channelId || i.channel?.id : i.options.getChannel('channel')?.id,
            page: ['help', 'leaderboard', 'top'].includes(action) ? i.options.getInteger('page') || 1 : 1,
            scope: action === 'top' ? i.options.getString('scope') || 'lifetime' : undefined,
            options,
        });
    } catch (error) { return errorReply(i, error, action); }
}
async function handleComponentWork(i) {
    if (!i.isButton?.() || !i.customId?.startsWith('counting:')) return false;
    const claimed = sessions.claim(i.customId, ownerOf(i));
    if (claimed.error) { await i.reply({ content: claimed.error, ephemeral: true }); return true; }
    const { id, item } = claimed;
    const data = item.payload;
    if (data.group?.used) {
        sessions.consume(id); await i.reply({ content: 'This preview has already been used or cancelled. Run the command again.', ephemeral: true }); return true;
    }
    if (data.group) data.group.used = true;
    sessions.consume(id); // Consume before any awaits; failed/ambiguous writes cannot be repeated with the same control.
    await i.deferUpdate();
    try {
        if (data.action === 'cancel') await i.editReply(payload('Cancelled. Nothing changed. Next: /counting help.', [nav(i, null)]));
        else await service.track(dispatch(i, data.action, data));
    } catch (error) { await errorReply(i, error, data.action); }
    return true;
}
function handleComponent(i) {
    if (!i.isButton?.() || !i.customId?.startsWith('counting:')) return Promise.resolve(false);
    return service.track(handleComponentWork(i));
}
module.exports = { execute: i => service.track(execute(i)), handleComponent, dispatch, payload, preview };
