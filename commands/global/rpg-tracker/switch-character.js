// commands/global/rpg-tracker/switch-character.js

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { getCharactersByGame, getCharacterWithStats } = require('../../../store/services/character.service');
const { getCurrentGame } = require('../../../store/services/player.service');
const { validateGameAccess } = require('../../../features/rpg-tracker/validate_game_access');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch-character')
        .setDescription('Select one of your characters from your current game to make active.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        if (!guildId) {
            return await interaction.reply({
                content: '⚠️ This command must be used in a server.',
                ephemeral: true,
            });
        }

        try {
            const currentGameId = await getCurrentGame(userId, guildId);
            if (!currentGameId) {
                return await interaction.reply({
                    content: '⚠️ You don\'t have an active game in this server. Use `/switch-game` or `/join-game` first.',
                    ephemeral: true,
                });
            }

            console.log('>>> switch-character.js > currentGameId:', currentGameId);

            const allCharacters = await getCharactersByGame(currentGameId);
            const eligibleOptions = [];

            for (const character of allCharacters) {
                const { valid } = await validateGameAccess({
                    gameId: character.game_id,
                    userId,
                });

                if (!valid) continue;

                const fullCharacter = await getCharacterWithStats(character.id);
                const level = fullCharacter.level ?? 1;
                const clazz = fullCharacter.class || 'Unclassed';
                const label = `${fullCharacter.name} (Lv ${level} ${clazz})`;

                const topStats = (fullCharacter.stats || [])
                    .slice()
                    .sort((a, b) => {
                        if ((a.sort_order ?? 999) !== (b.sort_order ?? 999)) {
                            return (a.sort_order ?? 999) - (b.sort_order ?? 999);
                        }
                        return a.label.localeCompare(b.label);
                    })
                    .slice(0, 4) // num of stats to show
                    .map(s => {
                        if (s.field_type === 'count') {
                            const current = s.meta?.current ?? '?';
                            const max = s.meta?.max ?? '?';
                            return `${s.label}: ${current} / ${max}`;
                        } else {
                            return `${s.label}: ${s.value}`;
                        }
                    });

                const description = topStats.join(' • ') || 'No stats available';

                eligibleOptions.push({
                    label: label.length > 100 ? label.slice(0, 97) + '…' : label,
                    description: description.length > 100 ? description.slice(0, 97) + '…' : description,
                    value: fullCharacter.id,
                });
            }

            if (!eligibleOptions.length) {
                return await interaction.reply({
                    content: '⚠️ You have no characters in published or accessible games.',
                    ephemeral: true,
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('switchCharacterDropdown')
                .setPlaceholder('Choose your character')
                .addOptions(eligibleOptions);

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.reply({
                content: '🎭 Choose your active character:',
                components: [row],
                ephemeral: true,
            });
        } catch (err) {
            console.error('[COMMAND ERROR] /switch-character:', err);
            await interaction.reply({
                content: '❌ Failed to display character switcher. Please try again later.',
                ephemeral: true,
            });
        }
    },
};
