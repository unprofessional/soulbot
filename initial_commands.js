// initial_commands.js

const fs = require('node:fs');
const path = require('node:path');
const { Collection, REST, Routes, Events } = require('discord.js');
require('dotenv').config();
const { shouldAcceptWork } = require('./app/lifecycle.js');
const {
    discordClientId,
    discordGuildId,
    registerGlobalCommands,
    registerGuildCommands,
    token,
} = require('./config/env_config.js');

/**
 * Recursively collect all .js files in a directory
 */
const getCommandFilesRecursively = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return getCommandFilesRecursively(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            return [fullPath];
        } else {
            return [];
        }
    });
};

const commandKey = command => `${command.type || 1}:${command.name}`;
const MESSAGE_CONTEXT_COMMAND_TYPE = 3;

const commandLogShape = command => ({
    id: command.id,
    name: command.name,
    type: command.type,
    contexts: command.contexts,
    integration_types: command.integration_types,
    dm_permission: command.dm_permission,
    default_member_permissions: command.default_member_permissions,
    version: command.version,
});

const stripGlobalOnlyCommandFields = command => {
    const commandBody = { ...command };
    delete commandBody.contexts;
    delete commandBody.integration_types;
    return commandBody;
};

const getMissingCommands = (requestedCommands, registeredCommands) => {
    const registeredList = Array.isArray(registeredCommands) ? registeredCommands : [];
    const registeredKeys = new Set(registeredList.map(commandKey));
    return requestedCommands.filter(command => !registeredKeys.has(commandKey(command)));
};

const logRegisteredCommands = (scope, requestedCommands, registeredCommands) => {
    const registeredList = Array.isArray(registeredCommands) ? registeredCommands : [];
    const missingCommands = getMissingCommands(requestedCommands, registeredCommands);

    console.log(`✅ Successfully registered ${registeredList.length}/${requestedCommands.length} ${scope} commands:`);
    console.table(registeredList.map(c => ({ name: c.name, type: c.type, description: c.description })));

    if (missingCommands.length > 0) {
        console.warn(`⚠️ Discord response was missing ${missingCommands.length} ${scope} command(s):`);
        console.table(missingCommands.map(c => ({ name: c.name, type: c.type, description: c.description })));
    }
};

const reconcileRegisteredCommands = async ({ rest, route, scope, requestedCommands }) => {
    const registeredCommands = await rest.get(route);
    const missingCommands = getMissingCommands(requestedCommands, registeredCommands);

    if (missingCommands.length === 0) {
        return;
    }

    console.warn(`⚠️ Discord readback was missing ${missingCommands.length} ${scope} command(s); upserting individually.`);
    console.table(missingCommands.map(c => ({ name: c.name, type: c.type, description: c.description })));

    for (const command of missingCommands) {
        await rest.post(route, { body: command });
        console.log(`✅ Upserted missing ${scope} command: ${command.name} (type ${command.type || 1})`);
    }

    const finalCommands = await rest.get(route);
    logRegisteredCommands(`${scope} commands after reconciliation`, requestedCommands, finalCommands);
};

const registerMessageContextCommandsForGuilds = async ({ client, rest, discordClientId, commands }) => {
    const messageContextCommands = commands.filter(command => (command.type || 1) === MESSAGE_CONTEXT_COMMAND_TYPE);

    if (messageContextCommands.length === 0) {
        console.log('[commands] No message context commands to register per guild.');
        return;
    }

    const guilds = [...client.guilds.cache.values()];
    console.log(`[commands] Registering ${messageContextCommands.length} message context command(s) across ${guilds.length} guild(s).`);

    for (const guild of guilds) {
        const route = Routes.applicationGuildCommands(discordClientId, guild.id);

        try {
            for (const command of messageContextCommands) {
                const commandBody = stripGlobalOnlyCommandFields(command);
                const registeredCommand = await rest.post(route, { body: commandBody });
                console.log(`[commands] Upserted guild message context command: guild=${guild.id} name="${command.name}"`);
                console.table([commandLogShape(registeredCommand)]);
            }

            const guildReadback = await rest.get(route);
            const contextReadback = Array.isArray(guildReadback)
                ? guildReadback.filter(command => command.type === MESSAGE_CONTEXT_COMMAND_TYPE)
                : [];
            console.log(`[commands] Guild message context readback: guild=${guild.id} count=${contextReadback.length}`);
            console.table(contextReadback.map(commandLogShape));
        } catch (err) {
            console.error(`[commands] Failed to register guild message context commands for guild=${guild.id}:`, err);
        }
    }
};

const initializeCommands = async (client) => {
    client.commands = new Collection();

    const commandsRootPath = path.resolve(__dirname, 'commands');
    const commandFiles = getCommandFilesRecursively(commandsRootPath);

    const commandsForAPI = [];
    const rest = token ? new REST({ version: '10' }).setToken(token) : null;

    for (const filePath of commandFiles) {
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commandsForAPI.push(command.data.toJSON());
                console.log(`✅ Loaded command: /${command.data.name}`);
            } else {
                console.warn(`⚠️ Skipped ${filePath}: missing "data" or "execute"`);
            }
        } catch (err) {
            console.error(`❌ Error loading command at ${filePath}:`, err);
        }
    }

    const shouldRegisterCommands = registerGuildCommands || registerGlobalCommands;
    const globalCommandsForAPI = commandsForAPI.filter(command => (command.type || 1) !== MESSAGE_CONTEXT_COMMAND_TYPE);
    const guildCommandsForAPI = registerGlobalCommands
        ? commandsForAPI.filter(command => (command.type || 1) !== MESSAGE_CONTEXT_COMMAND_TYPE)
        : commandsForAPI;

    if (shouldRegisterCommands && !token) {
        console.warn('⚠️ Command registration was requested, but DISCORD_BOT_TOKEN is not set.');
    }

    if (shouldRegisterCommands && !discordClientId) {
        console.warn('⚠️ Command registration was requested, but DISCORD_CLIENT_ID/CLIENT_ID is not set.');
    }

    // === Register guild application commands ===
    if (registerGuildCommands && rest && discordClientId && discordGuildId) {
        try {
            console.log('🔄 Registering guild application commands...');
            const registeredCommands = await rest.put(Routes.applicationGuildCommands(discordClientId, discordGuildId), {
                body: guildCommandsForAPI,
            });
            logRegisteredCommands(`guild commands for ${discordGuildId}`, guildCommandsForAPI, registeredCommands);
        } catch (err) {
            console.error('❌ Error registering guild application commands:', err);
        }
    } else if (registerGuildCommands && !discordGuildId) {
        console.warn('⚠️ REGISTER_GUILD_COMMANDS is true, but DISCORD_GUILD_ID/DEV_GUILD_ID is not set.');
    }

    // === Register global application commands ===
    if (registerGlobalCommands && rest && discordClientId) {
        try {
            const globalCommandsRoute = Routes.applicationCommands(discordClientId);
            console.log('🔄 Registering global application (/) commands...');
            const registeredCommands = await rest.put(globalCommandsRoute, {
                body: globalCommandsForAPI,
            });
            logRegisteredCommands('global commands', globalCommandsForAPI, registeredCommands);
            await reconcileRegisteredCommands({
                rest,
                route: globalCommandsRoute,
                scope: 'global',
                requestedCommands: globalCommandsForAPI,
            });
        } catch (err) {
            console.error('❌ Error registering application commands:', err);
        }
    } else {
        console.log('⏭️ Skipping global application command registration.');
    }

    // === Interaction Handlers ===
    client.on(Events.InteractionCreate, async interaction => {
        try {
            if (!shouldAcceptWork()) {
                const replyPayload = {
                    content: 'The bot is restarting and is temporarily not accepting new work. Please try again shortly.',
                    ephemeral: true,
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyPayload);
                } else {
                    await interaction.reply(replyPayload);
                }
                return;
            }

            if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`⚠️ No command found for: ${interaction.commandName}`);
                    return;
                }
                await command.execute(interaction);
            }

            else {
                console.warn('⚠️ Unhandled interaction type:', interaction.type);
            }

        } catch (err) {
            console.error('❌ Error handling interaction:', err);
            console.error('❌ Stack trace:', err.stack);

            const replyPayload = {
                content: 'There was an error while executing this action!',
                ephemeral: true,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyPayload);
            } else {
                await interaction.reply(replyPayload);
            }
        }
    });

    // Optional: Set bot status when ready
    client.once(Events.ClientReady, c => {
        console.log(`🤖 Bot ready: Logged in as ${c.user.tag}`);
        c.user.setPresence({
            activities: [{ name: 'with human emotions', type: 0 }],
            status: 'online',
        });

        if (registerGuildCommands && rest && discordClientId) {
            void registerMessageContextCommandsForGuilds({
                client,
                rest,
                discordClientId,
                commands: commandsForAPI,
            });
        }
    });

    return client;
};

module.exports = {
    initializeCommands,
    registerMessageContextCommandsForGuilds,
};
