/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

const Discord = require('discord.js');

const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordModals = require('../discordTools/discordModals.js');
const DiscordSelectMenus = require('../discordTools/discordSelectMenus.js');
const DiscordTools = require('../discordTools/discordTools.js');
const SteamApi = require('../util/steamApi.js');

module.exports = async (client, interaction) => {
    const instance = client.getInstance(interaction.guildId);
    const guildId = interaction.guildId;
    const rustplus = client.rustplusInstances[guildId];

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    await client.logInteraction(interaction, verifyId, 'userSelectMenu');

    if (instance.blacklist['discordIds'].includes(interaction.user.id) &&
        !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userPartOfBlacklist', {
            id: `${verifyId}`,
            user: `${interaction.user.username} (${interaction.user.id})`
        }));
        return;
    }

    if (interaction.customId === 'language') {
        instance.generalSettings.language = interaction.values[0];
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.language = interaction.values[0];

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.language}`
        }));

        await interaction.deferUpdate();

        client.loadGuildIntl(guildId);

        await client.interactionEditReply(interaction, {
            components: [DiscordSelectMenus.getLanguageSelectMenu(guildId, interaction.values[0])]
        });

        const guild = DiscordTools.getGuild(guildId);
        await require('../discordTools/RegisterSlashCommands.js')(client, guild);
    }
    else if (interaction.customId === 'Prefix') {
        instance.generalSettings.prefix = interaction.values[0];
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.prefix = interaction.values[0];

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.prefix}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getPrefixSelectMenu(guildId, interaction.values[0])]
        });
    }
    else if (interaction.customId === 'Trademark') {
        instance.generalSettings.trademark = interaction.values[0];
        client.setInstance(guildId, instance);

        if (rustplus) {
            rustplus.generalSettings.trademark = interaction.values[0];
            rustplus.trademarkString = (instance.generalSettings.trademark === 'NOT SHOWING') ?
                '' : `${instance.generalSettings.trademark} | `;
        }

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.trademark}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getTrademarkSelectMenu(guildId, interaction.values[0])]
        });
    }
    else if (interaction.customId === 'CommandDelay') {
        instance.generalSettings.commandDelay = interaction.values[0];
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.commandDelay = interaction.values[0];

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.commandDelay}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getCommandDelaySelectMenu(guildId, interaction.values[0])]
        });
    }
    else if (interaction.customId === 'VoiceGender') {
        instance.generalSettings.voiceGender = interaction.values[0];
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.voiceGender = interaction.values[0];

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.voiceGender}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordSelectMenus.getVoiceGenderSelectMenu(guildId, interaction.values[0])]
        });
    }
    else if (interaction.customId.startsWith('AutoDayNightOnOff')) {
        const ids = JSON.parse(interaction.customId.replace('AutoDayNightOnOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const value = parseInt(interaction.values[0]);
        if ((value !== 5 && value !== 6) ||
            ((value === 5 || value === 6) && server.switches[ids.entityId].location !== null)) {
            server.switches[ids.entityId].autoDayNightOnOff = value;
            client.setInstance(guildId, instance);
        }

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `${server.switches[ids.entityId].autoDayNightOnOff}`
        }));

        DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId, interaction);
    }
    else if (interaction.customId.startsWith('TrackerPlayerSelect')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerPlayerSelect', ''));
        const tracker = instance.trackers[ids.trackerId];
        const playerIndex = interaction.values[0];

        if (!tracker || playerIndex === 'none') {
            interaction.deferUpdate();
            return;
        }

        const modal = DiscordModals.getTrackerEditPlayerModal(guildId, ids.trackerId, parseInt(playerIndex));
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerPlayerRemove')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerPlayerRemove', ''));
        const tracker = instance.trackers[ids.trackerId];
        const playerIndex = interaction.values[0];

        if (!tracker || playerIndex === 'none') {
            interaction.deferUpdate();
            return;
        }

        const index = parseInt(playerIndex);
        const removedPlayer = tracker.players[index];
        tracker.players.splice(index, 1);
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `Removed player: ${removedPlayer.name}`
        }));

        await interaction.deferUpdate();
        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, null, false);
    }
    else if (interaction.customId.startsWith('TrackerPlayerScrape')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerPlayerScrape', ''));
        const tracker = instance.trackers[ids.trackerId];
        const playerIndex = interaction.values[0];

        if (!tracker || playerIndex === 'none') {
            await interaction.deferUpdate();
            return;
        }

        const player = tracker.players[parseInt(playerIndex)];
        if (!player || !player.steamId) {
            await interaction.reply({
                content: client.intlGet(guildId, 'playerNoSteamId'),
                ephemeral: true
            });
            return;
        }

        /* Defer the reply since Steam API calls may take time */
        await interaction.deferReply({ ephemeral: true });

        /* Get server player names from Battlemetrics */
        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];
        const serverPlayerNames = bmInstance ? Object.values(bmInstance.players).map(p => p.name) : [];

        /* Call Steam API functions */
        const [bansResult, serverResult] = await Promise.all([
            SteamApi.getFriendsWithBans(player.steamId),
            SteamApi.getFriendsOnServer(player.steamId, serverPlayerNames)
        ]);

        /* Build the embed */
        const embed = new Discord.EmbedBuilder()
            .setTitle(client.intlGet(guildId, 'scrapeSteamResultsTitle', { name: player.name }))
            .setColor('#2196F3')
            .setTimestamp();

        /* Check if profile is private */
        if (bansResult.isPrivate) {
            embed.setDescription(client.intlGet(guildId, 'steamProfilePrivate'));
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        /* Add total friends count */
        embed.setDescription(client.intlGet(guildId, 'totalFriendsCount', { count: bansResult.totalFriends }));

        /* Friends on Server section */
        if (serverResult.friendsOnServer.length > 0) {
            const friendsOnServerList = serverResult.friendsOnServer
                .slice(0, 15) /* Limit to 15 */
                .map(f => `• ${f.name}`)
                .join('\n');
            embed.addFields({
                name: client.intlGet(guildId, 'friendsOnServer', { count: serverResult.friendsOnServer.length }),
                value: friendsOnServerList || client.intlGet(guildId, 'none'),
                inline: false
            });
        } else {
            embed.addFields({
                name: client.intlGet(guildId, 'friendsOnServerHeader'),
                value: client.intlGet(guildId, 'noFriendsOnServer'),
                inline: false
            });
        }

        /* Friends with Bans section */
        if (bansResult.friendsWithBans.length > 0) {
            const friendsWithBansList = bansResult.friendsWithBans
                .slice(0, 15) /* Limit to 15 */
                .map(f => {
                    const bans = [];
                    if (f.vacBans > 0) bans.push(`${f.vacBans} VAC`);
                    if (f.gameBans > 0) bans.push(`${f.gameBans} Game`);
                    if (f.communityBanned) bans.push('Community');
                    const daysAgo = f.daysSinceLastBan > 0 ? ` (${f.daysSinceLastBan}d ago)` : '';
                    return `• ${f.name}: ${bans.join(', ')}${daysAgo}`;
                })
                .join('\n');
            embed.addFields({
                name: client.intlGet(guildId, 'friendsWithBans', { count: bansResult.friendsWithBans.length }),
                value: friendsWithBansList || client.intlGet(guildId, 'none'),
                inline: false
            });
        } else {
            embed.addFields({
                name: client.intlGet(guildId, 'friendsWithBansHeader'),
                value: client.intlGet(guildId, 'noFriendsWithBans'),
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'selectMenuValueChange', {
            id: `${verifyId}`,
            value: `Scraped Steam for player: ${player.name}`
        }));
    }

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userSelectMenuInteractionSuccess', {
        id: `${verifyId}`
    }));
}