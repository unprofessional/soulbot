// features/rpg-tracker/button_handlers.js

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { getCharactersByUser, getCharacterWithStats } = require('../../store/services/character.service');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-character')
        .setDescription("View your character's stats for this game's campaign."),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        try {
            const allCharacters = await getCharactersByUser(userId);
            const character = allCharacters.find(c => c.game_id && c.game_id.length && c.guild_id === guildId) || allCharacters[0];

            if (!character) {
                return await interaction.reply({
                    content: '⚠️ No character found. Use `/create-character` to start one.',
                    ephemeral: true,
                });
            }

            const full = await getCharacterWithStats(character.id);
            const statStr = full.stats.map(s => `**${s.name.toUpperCase()}**: ${s.value}`).join(' | ');

            const embed = new EmbedBuilder()
                .setTitle(`${full.name} — Level ${full.level} ${full.class}`)
                .setDescription(`*${full.race || 'Unknown Race'}*`)
                .addFields(
                    { name: 'HP', value: `${full.hp} / ${full.max_hp}`, inline: true },
                    { name: 'Stats', value: statStr || 'N/A', inline: true },
                )
                .setFooter({ text: `Created on ${new Date(full.created_at).toLocaleDateString()}` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`edit_hp:${full.id}`)
                    .setLabel('❤️ Edit HP')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`edit_stat:${full.id}`)
                    .setLabel('🎲 Edit Stat')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        } catch (err) {
            console.error('Error in /view-character:', err);
            await interaction.reply({
                content: '❌ Failed to retrieve character. Try again later.',
                ephemeral: true,
            });
        }
    },

    async handleButton(interaction) {
        const { customId } = interaction;

        // === Edit HP Modal ===
        if (customId.startsWith('edit_hp:')) {
            const characterId = customId.split(':')[1];

            const modal = new ModalBuilder()
                .setCustomId(`editHpModal:${characterId}`)
                .setTitle('Edit Character HP')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('currentHp')
                            .setLabel('Current HP')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('maxHp')
                            .setLabel('Max HP')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

        // === Edit Stat Modal ===
        if (customId.startsWith('edit_stat:')) {
            const characterId = customId.split(':')[1];

            const modal = new ModalBuilder()
                .setCustomId(`editStatModal:${characterId}`)
                .setTitle('Edit Character Stat')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('statName')
                            .setLabel('Stat Name (e.g., str, dex, con...)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('statValue')
                            .setLabel('New Stat Value')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                );

            return await interaction.showModal(modal);
        }

        // Unknown button
        return await interaction.reply({
            content: '❌ Unrecognized button interaction.',
            ephemeral: true,
        });
    }
};
