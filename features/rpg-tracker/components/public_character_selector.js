// features/rpg-tracker/components/paragraph_field_selector.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');

const id = 'paragraphFieldSelect';

/**
 * Builds a dummy select menu with one option.
 */
function build(character) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${id}:${character.id}`)
        .setPlaceholder('📜 Select a paragraph field to view')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Test Field')
                .setValue('test')
                .setDescription('A test field to trigger Hello World')
        );

    return new ActionRowBuilder().addComponents(menu);
}

/**
 * Handles selection and replies "Hello, world!"
 */
async function handle(interaction) {
    return await interaction.reply({
        content: '👋 Hello, world!',
        ephemeral: true,
    });
}

module.exports = { id, build, handle };
