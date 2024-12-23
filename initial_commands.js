const path = require('node:path');
const fs = require('node:fs');
const { Collection, REST, Routes, Events } = require('discord.js');
require('dotenv').config();

const initializeCommands = async (client) => {
    client.commands = new Collection();

    const foldersPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(foldersPath);

    const commands = []; // For registering commands via Discord REST API

    // Dynamically load command files
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);

            // Add the command to the client.commands Collection
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON()); // For Discord REST API registration
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }

    // Register commands using Discord's REST API
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

    try {
        console.log('Refreshing application (/) commands...');
        const clientId = process.env.DISCORD_CLIENT_ID;
        // const guildId = process.env.DISCORD_GUILD_ID; // Optional: For guild-specific commands

        // console.log('>>>>> initial_commands > clientId: ', clientId);
        // console.log('>>>>> initial_commands > guildId: ', guildId);

        // if (guildId) {
        //     // Register commands for a specific guild (useful for development)
        //     await rest.put(
        //         Routes.applicationGuildCommands(clientId, guildId),
        //         { body: commands }
        //     );
        //     console.log('Successfully reloaded guild (/) commands.');
        // } else {
            // Register global commands
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
            console.log('Successfully reloaded global (/) commands.');
        // }
    } catch (error) {
        console.error('Error refreshing commands:', error);
    }

    // Set up the InteractionCreate listener
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    });

    return client;
};

module.exports = { initializeCommands };
