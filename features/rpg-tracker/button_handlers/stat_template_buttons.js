const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    getStatTemplates,
    getGame,
} = require('../../../store/services/game.service');

const {
    buildStatTemplateModal,
} = require('../modal_handlers/stat_template_modals');

const {
    rebuildCreateGameResponse,
} = require('../utils/rebuild_create_game_response');

/**
 * Handles stat template-related button interactions.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
    const { customId } = interaction;

    // === Define Required Stats Modal ===
    if (customId.startsWith('defineStats:')) {
        const [, gameId] = customId.split(':');
        const modal = buildStatTemplateModal({ gameId });
        return await interaction.showModal(modal);
    }

    // === Edit Stats Button (trigger dropdown on the same message)
    if (customId.startsWith('editStats:')) {
        const [, gameId] = customId.split(':');

        const [game, statTemplates] = await Promise.all([
            getGame({ id: gameId }),
            getStatTemplates(gameId),
        ]);

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

        const options = statTemplates
            .filter((f) => typeof f.label === 'string' && f.label.trim().length > 0 && typeof f.id === 'string')
            .map((f, i) => ({
                label: `${i + 1}. ${f.label.trim()}`,
                description: `Type: ${f.field_type} — Default: ${f.default_value || 'None'}`,
                value: f.id,
            }));

        if (!options.length) {
            return await interaction.reply({
                content: '⚠️ No valid stat labels found. Please edit or recreate your stat fields.',
                ephemeral: true,
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`editStatSelect:${gameId}`)
            .setPlaceholder('Select a stat field to edit')
            .addOptions(options);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const cancelRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cancelStatEdit:${gameId}`)
                .setLabel('⬅️ Go Back')
                .setStyle(ButtonStyle.Secondary)
        );

        const { embed } = rebuildCreateGameResponse(game, statTemplates);

        return await interaction.update({
            content: `🎲 Select a field to edit for **${game.name}**`,
            embeds: [embed],
            components: [selectRow, cancelRow],
        });
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

    // === Cancel Edit Stat (return to /create-game view) ===
    if (customId.startsWith('cancelStatEdit:')) {
        const [, gameId] = customId.split(':');

        const [game, fields] = await Promise.all([
            getGame({ id: gameId }),
            getStatTemplates(gameId),
        ]);

        const { content, embed, buttons } = rebuildCreateGameResponse(game, fields);

        return await interaction.update({
            content,
            embeds: [embed],
            components: [buttons],
        });
    }

    // === Finish Stat Setup ===
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

            const { content, embed, buttons } = rebuildCreateGameResponse(game, stats);

            await interaction.deferUpdate();
            await interaction.editReply({
                content,
                embeds: [embed],
                components: [buttons],
            });

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
