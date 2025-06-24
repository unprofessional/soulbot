// commands/global/rpg-tracker/switch-character.js

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getCharactersByUser } = require('../../../store/services/character.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch-character')
        .setDescription('Select one of your characters to make active.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        try {
            const characters = await getCharactersByUser(userId, guildId);

            if (!characters.length) {
                return await interaction.reply({
                    content: '⚠️ You have no characters to choose from. Use `/create-character` to make one.',
                    ephemeral: true,
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('switchCharacterDropdown')
                .setPlaceholder('Choose your character')
                .addOptions(
                    characters.map(c => ({
                        label: `${c.name} (Lv ${c.level} ${c.class})`,
                        description: c.race || 'Unnamed race',
                        value: c.id,
                    }))
                );

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.reply({
                content: '🎭 Choose your active character:',
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('Error in /switch-character:', err);
            await interaction.reply({
                content: '❌ Failed to display character switcher.',
                ephemeral: true,
            });
        }
    },
};
