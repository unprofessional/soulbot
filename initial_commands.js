// initial_commands.js

const fs = require('node:fs');
const path = require('node:path');
const { Collection, REST, Routes, Events } = require('discord.js');
require('dotenv').config();

const { DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN } = process.env;

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

const initializeCommands = async (client) => {
    client.commands = new Collection();

    const commandsRootPath = path.resolve(__dirname, 'commands');
    const commandFiles = getCommandFilesRecursively(commandsRootPath);

    const commandsForAPI = [];
    const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

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

    // === Register global application commands ===
    try {
        console.log('🔄 Registering global application (/) commands:', commandsForAPI.map(c => c.name));
        await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
            body: commandsForAPI,
        });
        console.log(`✅ Successfully registered ${commandsForAPI.length} global (/) commands.`);
    } catch (err) {
        console.error('❌ Error registering application commands:', err);
    }

    // === Interaction Handlers ===
    client.on(Events.InteractionCreate, async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`⚠️ No command found for: ${interaction.commandName}`);
                    return;
                }
                await command.execute(interaction);
            }

            else if (interaction.isModalSubmit()) {
                const modalHandler = require('./features/rpg-tracker/modal_handlers.js');
                await modalHandler.handleModal(interaction);
            }

            else if (interaction.isButton()) {
                console.log('🔘 Button interaction received:', interaction.customId);
                const buttonHandler = require('./features/rpg-tracker/button_handlers.js');
                await buttonHandler.handleButton(interaction);
            }

            else if (interaction.isStringSelectMenu()) {
                const selectMenuHandler = require('./features/rpg-tracker/select_menu_handlers.js');
                await selectMenuHandler.handleSelectMenu(interaction);
            }

        } catch (err) {
            console.error('❌ Error handling interaction:', err);
            console.error('❌ Error stack trace:', err.stack);

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

    return client;
};

module.exports = { initializeCommands };
