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

const Battlemetrics = require('../structures/Battlemetrics');
const Constants = require('../util/constants.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const Keywords = require('../util/keywords.js');
const Scrape = require('../util/scrape.js');
const SteamApi = require('../util/steamApi.js');

module.exports = async (client, interaction) => {
    const instance = client.getInstance(interaction.guildId);
    const guildId = interaction.guildId;

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    await client.logInteraction(interaction, verifyId, 'userModal');

    if (instance.blacklist['discordIds'].includes(interaction.user.id) &&
        !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userPartOfBlacklist', {
            id: `${verifyId}`,
            user: `${interaction.user.username} (${interaction.user.id})`
        }));
        return;
    }

    if (interaction.customId.startsWith('CustomTimersEdit')) {
        const ids = JSON.parse(interaction.customId.replace('CustomTimersEdit', ''));
        const server = instance.serverList[ids.serverId];
        const cargoShipEgressTime = parseInt(interaction.fields.getTextInputValue('CargoShipEgressTime'));
        const oilRigCrateUnlockTime = parseInt(interaction.fields.getTextInputValue('OilRigCrateUnlockTime'));

        if (!server) {
            interaction.deferUpdate();
            return;
        }

        if (cargoShipEgressTime && ((cargoShipEgressTime * 1000) !== server.cargoShipEgressTimeMs)) {
            server.cargoShipEgressTimeMs = cargoShipEgressTime * 1000;
        }
        if (oilRigCrateUnlockTime && ((oilRigCrateUnlockTime * 1000) !== server.oilRigLockedCrateUnlockTimeMs)) {
            server.oilRigLockedCrateUnlockTimeMs = oilRigCrateUnlockTime * 1000;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.cargoShipEgressTimeMs}, ${server.oilRigLockedCrateUnlockTimeMs}`
        }));
    }
    else if (interaction.customId.startsWith('ServerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('ServerEdit', ''));
        const server = instance.serverList[ids.serverId];
        const battlemetricsId = interaction.fields.getTextInputValue('ServerBattlemetricsId');

        if (battlemetricsId !== server.battlemetricsId) {
            if (battlemetricsId === '') {
                server.battlemetricsId = null;
            }
            else if (client.battlemetricsInstances.hasOwnProperty(battlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[battlemetricsId];
                server.battlemetricsId = battlemetricsId;
                server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
            }
            else {
                const bmInstance = new Battlemetrics(battlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    client.battlemetricsInstances[battlemetricsId] = bmInstance;
                    server.battlemetricsId = battlemetricsId;
                    server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
                }
            }
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.battlemetricsId}`
        }));

        await DiscordMessages.sendServerMessage(interaction.guildId, ids.serverId);

        /* To force search of player name via scrape */
        client.battlemetricsIntervalCounter = 0;
    }
    else if (interaction.customId.startsWith('SmartSwitchEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchEdit', ''));
        const server = instance.serverList[ids.serverId];
        const smartSwitchName = interaction.fields.getTextInputValue('SmartSwitchName');
        const smartSwitchCommand = interaction.fields.getTextInputValue('SmartSwitchCommand');
        let smartSwitchProximity = null;
        try {
            smartSwitchProximity = parseInt(interaction.fields.getTextInputValue('SmartSwitchProximity'));
        }
        catch (e) {
            smartSwitchProximity = null;
        }

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.switches[ids.entityId].name = smartSwitchName;

        if (smartSwitchCommand !== server.switches[ids.entityId].command &&
            !Keywords.getListOfUsedKeywords(client, guildId, ids.serverId).includes(smartSwitchCommand)) {
            server.switches[ids.entityId].command = smartSwitchCommand;
        }

        if (smartSwitchProximity !== null && smartSwitchProximity >= 0) {
            server.switches[ids.entityId].proximity = smartSwitchProximity;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartSwitchName}, ${server.switches[ids.entityId].command}`
        }));

        await DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('GroupEdit')) {
        const ids = JSON.parse(interaction.customId.replace('GroupEdit', ''));
        const server = instance.serverList[ids.serverId];
        const groupName = interaction.fields.getTextInputValue('GroupName');
        const groupCommand = interaction.fields.getTextInputValue('GroupCommand');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].name = groupName;

        if (groupCommand !== server.switchGroups[ids.groupId].command &&
            !Keywords.getListOfUsedKeywords(client, interaction.guildId, ids.serverId).includes(groupCommand)) {
            server.switchGroups[ids.groupId].command = groupCommand;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${groupName}, ${server.switchGroups[ids.groupId].command}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupAddSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupAddSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupAddSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        if (!Object.keys(server.switches).includes(switchId) ||
            server.switchGroups[ids.groupId].switches.includes(switchId)) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].switches.push(switchId);
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupRemoveSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupRemoveSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].switches =
            server.switchGroups[ids.groupId].switches.filter(e => e !== switchId);
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('SmartAlarmEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartAlarmEdit', ''));
        const server = instance.serverList[ids.serverId];
        const smartAlarmName = interaction.fields.getTextInputValue('SmartAlarmName');
        const smartAlarmMessage = interaction.fields.getTextInputValue('SmartAlarmMessage');
        const smartAlarmCommand = interaction.fields.getTextInputValue('SmartAlarmCommand');

        if (!server || (server && !server.alarms.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.alarms[ids.entityId].name = smartAlarmName;
        server.alarms[ids.entityId].message = smartAlarmMessage;

        if (smartAlarmCommand !== server.alarms[ids.entityId].command &&
            !Keywords.getListOfUsedKeywords(client, guildId, ids.serverId).includes(smartAlarmCommand)) {
            server.alarms[ids.entityId].command = smartAlarmCommand;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartAlarmName}, ${smartAlarmMessage}, ${server.alarms[ids.entityId].command}`
        }));

        await DiscordMessages.sendSmartAlarmMessage(interaction.guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('StorageMonitorEdit')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorEdit', ''));
        const server = instance.serverList[ids.serverId];
        const storageMonitorName = interaction.fields.getTextInputValue('StorageMonitorName');

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.storageMonitors[ids.entityId].name = storageMonitorName;
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${storageMonitorName}`
        }));

        await DiscordMessages.sendStorageMonitorMessage(interaction.guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('TrackerEditPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEditPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const playerIndex = ids.playerIndex;

        if (!tracker || playerIndex === undefined || !tracker.players[playerIndex]) {
            await interaction.deferUpdate();
            return;
        }

        /* Get new values - empty string means clear */
        let newSteamId = '';
        let newBmId = '';
        let newDiscordId = '';
        try {
            newSteamId = interaction.fields.getTextInputValue('TrackerEditPlayerSteamId');
        } catch (e) { /* ignore */ }
        try {
            newBmId = interaction.fields.getTextInputValue('TrackerEditPlayerBmId');
        } catch (e) { /* ignore */ }
        try {
            newDiscordId = interaction.fields.getTextInputValue('TrackerEditPlayerDiscordId');
        } catch (e) { /* ignore */ }

        /* Update player fields - empty string clears the field */
        tracker.players[playerIndex].steamId = newSteamId === '' ? null : newSteamId;
        tracker.players[playerIndex].playerId = newBmId === '' ? null : newBmId;

        /* Handle Discord ID - could be numeric ID or username */
        let resolvedDiscordId = null;
        if (newDiscordId !== '') {
            if (/^\d+$/.test(newDiscordId)) {
                /* Already a numeric ID */
                resolvedDiscordId = newDiscordId;
            } else {
                /* Try to find member by username */
                try {
                    const guild = await client.guilds.fetch(interaction.guildId);
                    const members = await guild.members.fetch({ query: newDiscordId, limit: 10 });
                    for (const [, member] of members) {
                        if (member.user.username.toLowerCase() === newDiscordId.toLowerCase() ||
                            member.displayName.toLowerCase() === newDiscordId.toLowerCase()) {
                            resolvedDiscordId = member.user.id;
                            break;
                        }
                    }
                } catch (e) {
                    /* Couldn't find member */
                }
            }
        }
        tracker.players[playerIndex].discordId = resolvedDiscordId;

        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `Edited player index: ${playerIndex}`
        }));

        /* Respond immediately - no API calls */
        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, interaction, false);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userModalInteractionSuccess', {
            id: `${verifyId}`
        }));
        return;
    }
    else if (interaction.customId.startsWith('TrackerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEdit', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        const trackerName = interaction.fields.getTextInputValue('TrackerName');
        const trackerBattlemetricsId = interaction.fields.getTextInputValue('TrackerBattlemetricsId');
        const trackerClanTag = interaction.fields.getTextInputValue('TrackerClanTag');

        let trackerBaseLocation = '';
        let trackerNotes = '';
        try {
            trackerBaseLocation = interaction.fields.getTextInputValue('TrackerBaseLocation');
        } catch (e) { /* ignore */ }
        try {
            trackerNotes = interaction.fields.getTextInputValue('TrackerNotes');
        } catch (e) { /* ignore */ }

        /* Save simple fields immediately */
        tracker.name = trackerName;
        tracker.baseLocation = trackerBaseLocation === '' ? null : trackerBaseLocation;
        tracker.notes = trackerNotes === '' ? null : trackerNotes;

        if (trackerClanTag !== tracker.clanTag) {
            tracker.clanTag = trackerClanTag;
            client.battlemetricsIntervalCounter = 0;
        }

        const bmIdChanged = trackerBattlemetricsId !== tracker.battlemetricsId;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${trackerName}, ${tracker.battlemetricsId}, ${tracker.clanTag}`
        }));

        /* Respond immediately - no API calls */
        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, interaction, false);

        /* If battlemetrics ID changed, do the setup in background and update again */
        if (bmIdChanged) {
            if (client.battlemetricsInstances.hasOwnProperty(trackerBattlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[trackerBattlemetricsId];
                tracker.battlemetricsId = trackerBattlemetricsId;
                tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
                tracker.img = Constants.DEFAULT_SERVER_IMG;
                tracker.title = bmInstance.server_name;
                client.setInstance(guildId, instance);
                await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, null, true);
            }
            else {
                const bmInstance = new Battlemetrics(trackerBattlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    client.battlemetricsInstances[trackerBattlemetricsId] = bmInstance;
                    tracker.battlemetricsId = trackerBattlemetricsId;
                    tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
                    tracker.img = Constants.DEFAULT_SERVER_IMG;
                    tracker.title = bmInstance.server_name;
                    client.setInstance(guildId, instance);
                    await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, null, true);
                }
            }
        }
        return;
    }
    else if (interaction.customId.startsWith('TrackerAddPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerAddPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const id = interaction.fields.getTextInputValue('TrackerAddPlayerId');
        let discordId = null;
        try {
            discordId = interaction.fields.getTextInputValue('TrackerAddPlayerDiscordId') || null;
            if (discordId === '') discordId = null;
        } catch (e) {
            discordId = null;
        }

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        const isSteamId64 = id.length === Constants.STEAMID64_LENGTH ? true : false;
        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

        if ((isSteamId64 && tracker.players.some(e => e.steamId === id)) ||
            (!isSteamId64 && tracker.players.some(e => e.playerId === id && e.steamId === null))) {
            interaction.deferUpdate();
            return;
        }

        let name = null;
        let steamId = null;
        let playerId = null;
        let needsNameFetch = false;

        /* For BM ID, try to get name from cache */
        if (!isSteamId64) {
            playerId = id;
            if (bmInstance && bmInstance.players.hasOwnProperty(id)) {
                name = bmInstance.players[id]['name'];
            }
            else {
                name = 'Loading...';
                needsNameFetch = true;
            }
        }
        else {
            steamId = id;
            name = 'Loading...';
        }

        /* Add player immediately with what we have */
        const playerIndex = tracker.players.length;
        tracker.players.push({
            name: name,
            steamId: steamId,
            playerId: playerId,
            discordId: discordId
        });
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${id}`
        }));

        /* Respond immediately */
        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, interaction, false);

        /* Fetch name in background if needed */
        if (isSteamId64) {
            /* Steam ID - fetch name via Steam API */
            const steamSummaries = await SteamApi.getPlayerSummaries(id);
            const summary = steamSummaries[id];
            if (summary?.personaName) {
                tracker.players[playerIndex].name = summary.personaName;
                if (bmInstance) {
                    const foundPlayerId = Object.keys(bmInstance.players).find(e => bmInstance.players[e]['name'] === summary.personaName);
                    if (foundPlayerId) tracker.players[playerIndex].playerId = foundPlayerId;
                }
                client.setInstance(interaction.guildId, instance);
                await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, null, false);
            }
        }
        else if (needsNameFetch) {
            /* BM ID not in cache - fetch from API */
            const fetchedName = await Battlemetrics.getPlayerName(id);
            if (fetchedName) {
                tracker.players[playerIndex].name = fetchedName;
                client.setInstance(interaction.guildId, instance);
                await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, null, false);
            }
        }
        return;
    }
    else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerRemovePlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const id = interaction.fields.getTextInputValue('TrackerRemovePlayerId');

        const isSteamId64 = id.length === Constants.STEAMID64_LENGTH ? true : false;

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        if (isSteamId64) {
            tracker.players = tracker.players.filter(e => e.steamId !== id);
        }
        else {
            tracker.players = tracker.players.filter(e => e.playerId !== id || e.steamId !== null);
        }
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${id}`
        }));

        /* Respond immediately */
        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, interaction, false);
        return;
    }
    else if (interaction.customId.startsWith('TrackerBulkAddPlayers')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerBulkAddPlayers', ''));
        const tracker = instance.trackers[ids.trackerId];
        const input = interaction.fields.getTextInputValue('TrackerBulkAddPlayerIds');

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        /* Parse input - split by newlines only to preserve steamId/bmId format */
        const lines = input.split(/[\n]+/).map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length === 0) {
            interaction.deferUpdate();
            return;
        }

        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];
        const addedPlayers = [];

        for (const line of lines) {
            let steamId = null;
            let playerId = null;
            let name = 'Loading...';

            /* Check if line contains both steamId/bmId */
            if (line.includes('/')) {
                const parts = line.split('/').map(p => p.trim());
                if (parts.length >= 2) {
                    /* First part is Steam ID, second is BM ID */
                    if (parts[0].length === Constants.STEAMID64_LENGTH) {
                        steamId = parts[0];
                        playerId = parts[1];
                    } else if (parts[1].length === Constants.STEAMID64_LENGTH) {
                        /* In case they put bmId/steamId */
                        steamId = parts[1];
                        playerId = parts[0];
                    } else {
                        /* Both look like BM IDs, use first as BM ID */
                        playerId = parts[0];
                    }
                }
            } else {
                /* Single ID - determine type by length */
                const id = line.trim();
                if (id.length === Constants.STEAMID64_LENGTH) {
                    steamId = id;
                } else {
                    playerId = id;
                }
            }

            /* Skip if already exists */
            if (steamId && tracker.players.some(e => e.steamId === steamId)) {
                continue;
            }
            if (!steamId && playerId && tracker.players.some(e => e.playerId === playerId && e.steamId === null)) {
                continue;
            }

            /* Try to get name from BM cache if we have a BM ID */
            if (playerId && bmInstance && bmInstance.players.hasOwnProperty(playerId)) {
                name = bmInstance.players[playerId]['name'];
            }

            const playerIndex = tracker.players.length;
            tracker.players.push({
                name: name,
                steamId: steamId,
                playerId: playerId,
                discordId: null
            });
            addedPlayers.push({
                index: playerIndex,
                steamId: steamId,
                playerId: playerId,
                needsSteamName: steamId && name === 'Loading...',
                needsBmName: !steamId && playerId && name === 'Loading...'
            });
        }

        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `Bulk added ${addedPlayers.length} players`
        }));

        /* Respond immediately */
        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, interaction, false);

        /* Fetch names in background for players that need it */
        const playersNeedingSteamName = addedPlayers.filter(p => p.needsSteamName);
        const playersNeedingBmName = addedPlayers.filter(p => p.needsBmName);

        /* Batch fetch Steam names via API */
        if (playersNeedingSteamName.length > 0) {
            const steamIds = playersNeedingSteamName.map(p => p.steamId);
            const steamSummaries = await SteamApi.getPlayerSummaries(steamIds);
            for (const player of playersNeedingSteamName) {
                const summary = steamSummaries[player.steamId];
                if (summary?.personaName && tracker.players[player.index]) {
                    tracker.players[player.index].name = summary.personaName;
                    /* If no BM ID was provided, try to find one by name */
                    if (!player.playerId && bmInstance) {
                        const foundPlayerId = Object.keys(bmInstance.players).find(
                            e => bmInstance.players[e]['name'] === summary.personaName
                        );
                        if (foundPlayerId) tracker.players[player.index].playerId = foundPlayerId;
                    }
                }
            }
        }

        /* Fetch Battlemetrics names for players with only BM ID */
        for (const player of playersNeedingBmName) {
            if (tracker.players[player.index] && tracker.players[player.index].name === 'Loading...') {
                const fetchedName = await Battlemetrics.getPlayerName(player.playerId);
                if (fetchedName) {
                    tracker.players[player.index].name = fetchedName;
                }
            }
        }

        /* Update message with resolved names */
        if (addedPlayers.length > 0) {
            client.setInstance(interaction.guildId, instance);
            await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId, null, false);
        }
        return;
    }

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userModalInteractionSuccess', {
        id: `${verifyId}`
    }));

    interaction.deferUpdate();
}