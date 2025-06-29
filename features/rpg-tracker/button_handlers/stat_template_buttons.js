// features/rpg-tracker/button_handlers/stat_template_buttons.js

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

    // === Edit Stats Button (show dropdown and cancel option)
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

        const options = statTemplates.map((f, i) => ({
            label: `${i + 1}. ${f.label}`,
            description: `Type: ${f.field_type} — Default: ${f.default_value || 'None'}`,
            value: f.id,
        }));

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

        return await interaction.update({
            content: `🎲 Select a field to edit for **${game.name}**`,
            embeds: [rebuildCreateGameResponse(game, statTemplates).embed],
            components: [selectRow, cancelRow],
        });
    }

    // === Edit Stat Template Modal trigger (via direct button, not used currently) ===
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

    // === Cancel Edit Stat (go back to main /create-game view)
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

    // === Finalize Stat Setup (refreshes embed/buttons cleanly)
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
