// features/rpg-tracker/button_handlers/stat_template_buttons.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getStatTemplates,
    getStatTemplateById,
    deleteStatTemplate,
    getGame,
} = require('../../../store/services/game.service');

const { buildStatTemplateModal } = require('../modal_handlers/stat_template_modals');
const { rebuildCreateGameResponse } = require('../utils/rebuild_create_game_response');
const { buildStatTypeDropdown } = require('../components/stat_type_select');

/**
 * Handles stat template-related button interactions.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === Define Required Stats Modal ===
    if (customId.startsWith('defineStats:')) {
        const [, gameId] = customId.split(':');
        const row = buildStatTypeDropdown(gameId);

        return await interaction.update({
            content: [
                `# Define a new GAME stat field**`,
                ``,
                `### Choose the *type* of stat you want to define.`,
                `⚠️ Once created, the stat type CANNOT be changed.`,
                `⚠️ If you make a mistake, you must delete the stat and recreate it with the correct type.`,
                ``,
                `#### **Stat Types & Examples:**`,
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
                `(Remember there is already a SYSTEM-provided character BIO field!)`,
                ``,
                `Select a stat type from the dropdown below.`,
                ``,
            ].join('\n'),
            components: [row],
            embeds: [],
        });
    }

    // === Edit Stats Button (trigger edit dropdown)
    if (customId.startsWith('editStats:')) {
        const [, gameId] = customId.split(':');

        const game = await getGame({ id: gameId });
        const statTemplates = await getStatTemplates(gameId);

        if (!game || game.created_by !== interaction.user.id) {
            return await interaction.reply({
                content: '⚠️ Only the GM can edit this game.',
                ephemeral: true,
            });
        }

        if (!statTemplates.length) {
            return await interaction.reply({
                content: '⚠️ No stats to edit yet. Use "Define Required Stats" first.',
                ephemeral: true,
            });
        }

        const options = statTemplates.map((f, i) => ({
            label: `${i + 1}. ${f.label}`,
            description: `Type: ${f.field_type} — Default: ${f.default_value || 'None'}`,
            value: f.id,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`editStatSelect:${gameId}`)
            .setPlaceholder('Select a stat field to edit')
            .addOptions(options);

        const cancelBtn = new ButtonBuilder()
            .setCustomId(`finishStatSetup:${gameId}`)
            .setLabel('↩️ Cancel / Go Back')
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);
        const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

        return await interaction.update({
            content: `🎲 Select a field to edit for **${game.name}**`,
            embeds: [],
            components: [actionRow, cancelRow],
        });
    }

    // === Delete Stats Button (trigger delete dropdown)
    if (customId.startsWith('deleteStats:')) {
        const [, gameId] = customId.split(':');

        const game = await getGame({ id: gameId });
        const statTemplates = await getStatTemplates(gameId);

        if (!game || game.created_by !== interaction.user.id) {
            return await interaction.reply({
                content: '⚠️ Only the GM can delete stat fields.',
                ephemeral: true,
            });
        }

        if (!statTemplates.length) {
            return await interaction.reply({
                content: '⚠️ No stats to delete.',
                ephemeral: true,
            });
        }

        const options = statTemplates.map((f, i) => ({
            label: `${i + 1}. ${f.label}`,
            description: `Type: ${f.field_type}`,
            value: f.id,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`deleteStatSelect:${gameId}`)
            .setPlaceholder('Select a stat field to delete')
            .addOptions(options);

        const cancelBtn = new ButtonBuilder()
            .setCustomId(`finishStatSetup:${gameId}`)
            .setLabel('↩️ Cancel / Go Back')
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);
        const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

        return await interaction.update({
            content: `🗑️ Select a stat field to delete from **${game.name}**`,
            embeds: [],
            components: [actionRow, cancelRow],
        });
    }

    // === Confirm Delete Stat ===
    if (customId.startsWith('confirmDeleteStat:')) {
        const [, statId] = customId.split(':');

        try {
            const stat = await getStatTemplateById(statId);
            if (!stat) {
                return await interaction.reply({
                    content: '❌ That stat no longer exists.',
                    ephemeral: true,
                });
            }

            await deleteStatTemplate(statId);

            const [game, updatedStats] = await Promise.all([
                getGame({ id: stat.game_id }),
                getStatTemplates(stat.game_id),
            ]);

            return await interaction.update(rebuildCreateGameResponse(game, updatedStats));
        } catch (err) {
            console.error('Error confirming stat deletion:', err);
            return await interaction.reply({
                content: '❌ Failed to delete stat.',
                ephemeral: true,
            });
        }
    }

    // === Edit Stat Template Modal ===
    if (customId.startsWith('edit_stat_template:')) {
        const [, statFieldId] = customId.split(':');

        const statTemplates = await getStatTemplates();
        const currentField = statTemplates.find(f => f.id === statFieldId);

        if (!currentField) {
            return await interaction.reply({
                content: '❌ Could not find stat template to edit.',
                ephemeral: true,
            });
        }

        const modal = buildStatTemplateModal({ gameId: null, field: currentField });
        return await interaction.showModal(modal);
    }

    // === Finish Stat Setup / Go Back ===
    if (customId.startsWith('finishStatSetup:')) {
        const [, gameId] = customId.split(':');

        try {
            const [game, stats] = await Promise.all([
                getGame({ id: gameId }),
                getStatTemplates(gameId),
            ]);

            if (!game) {
                return await interaction.reply({
                    content: '❌ Game not found. You may need to recreate it.',
                    ephemeral: true,
                });
            }

            await interaction.deferUpdate();
            await interaction.editReply(rebuildCreateGameResponse(game, stats));
        } catch (err) {
            console.error('Error in finishStatSetup:', err);
            return await interaction.reply({
                content: '❌ Something went wrong while finalizing your game setup.',
                ephemeral: true,
            });
        }
    }
}

module.exports = { handle };
