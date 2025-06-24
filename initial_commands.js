// initial_commands.js

const fs = require('node:fs');
const path = require('node:path');
const { Collection, REST, Routes, Events } = require('discord.js');
require('dotenv').config();

const { DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN } = process.env;

const initializeCommands = async (client) => {
    client.commands = new Collection();

    const foldersPath = path.resolve(__dirname, 'commands');
    const commandFolders = fs.readdirSync(foldersPath);

    const commandsForAPI = [];
    const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

    // === Load all command files ===
    for (const folder of commandFolders) {
        const folderPath = path.join(foldersPath, folder);
        const commandFiles = fs
            .readdirSync(folderPath, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.endsWith('.js'))
            .map(f => f.name);

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commandsForAPI.push(command.data.toJSON());
                } else {
                    console.warn(`[WARN] Command file at ${filePath} is missing "data" or "execute" export.`);
                }
            } catch (err) {
                console.error(`[ERROR] Failed to load command at ${filePath}:`, err);
            }
        }
    }

    // === Register global application commands ===
    try {
        console.log('🔄 Registering global application (/) commands...');
        await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
            body: commandsForAPI,
        });
        console.log(`✅ Successfully registered ${commandsForAPI.length} global (/) commands.`);
    } catch (err) {
        console.error('❌ Error registering application commands:', err);
    }

    // === Handle interactions: slash, modal, button, select menu ===
    client.on(Events.InteractionCreate, async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`[WARN] No matching command for: ${interaction.commandName}`);
                    return;
                }
                await command.execute(interaction);
            }

            else if (interaction.isModalSubmit()) {
                const modalHandler = require('./features/rpg-tracker/modal_handlers.js');
                await modalHandler.handleModal(interaction);
            }

            else if (interaction.isButton()) {
                const buttonHandler = require('./features/rpg-tracker/button_handlers.js');
                await buttonHandler.handleButton(interaction);
            }
            
            else if (interaction.isStringSelectMenu()) {
                const selectMenuHandler = require('./features/rpg-tracker/select_menu_handlers.js');
                await selectMenuHandler.handleSelectMenu(interaction);
            }
        } catch (err) {
            console.error('❌ Error handling interaction:', err);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'There was an error while executing this action!',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: 'There was an error while executing this action!',
                    ephemeral: true,
                });
            }
        }
    });

    return client;
};

module.exports = { initializeCommands };
