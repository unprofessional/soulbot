// features/rpg-tracker/components/define_stats_button.js

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getGame } = require('../../../store/services/game.service');
const { build: buildStatTypeDropdown } = require('./stat_type_selector');

const id = 'defineStats';

function build(gameId) {
    return new ButtonBuilder()
        .setCustomId(`${id}:${gameId}`)
        .setLabel('➕ Add Another Stat')
        .setStyle(ButtonStyle.Primary);
}

async function handle(interaction) {
    const [, gameId] = interaction.customId.split(':');
    const game = await getGame({ id: gameId });

    if (!game || game.created_by !== interaction.user.id) {
        return await interaction.reply({
            content: '⚠️ Only the GM can define new stat fields.',
            ephemeral: true,
        });
    }

    const dropdownRow = buildStatTypeDropdown(gameId);

    const cancelBtn = new ButtonBuilder()
        .setCustomId(`finishStatSetup:${gameId}`)
        .setLabel('↩️ Cancel / Go Back')
        .setStyle(ButtonStyle.Secondary);

    const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

    return await interaction.update({
        content: [
            `## Define a new GAME stat field`,
            ``,
            `### Choose the *type* of stat you want to define.`,
            `⚠️ **Once created, the stat type CANNOT be changed.**`,
            `If you make a mistake, you must delete the stat and recreate it with the correct type.`,
            ``,
            `### Stat Types & Examples:`,
            ``,
            `🔢 **Number** — a single value (no max/current):`,
            `• Level, Gold, XP, Strength, Agility, Reputation, Kills, Karma`,
            ``,
            `🔁 **Count** — tracks both max and current value:`,
            `• HP, MP, Mana, FP, Charges, Ammo, Sanity`,
            ``,
            `💬 **Text (one-line)** — short string inputs:`,
            `• Race, Class, Allegiance, Faction`,
            ``,
            `📝 **Text (multi-line)** — paragraph-style notes:`,
            `• Personality, History, Abilities, Quirks`,
            `_(Remember: every character already has a built-in BIO field.)_`,
            ``,
            `Select a stat type from the dropdown below.`,
        ].join('\n'),
        components: [dropdownRow, cancelRow],
        embeds: [],
    });
}

module.exports = { id, build, handle };
