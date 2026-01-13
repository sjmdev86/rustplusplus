/*
    Copyright (C) 2024

    Steam Web API helper for fetching player status information.
*/

const Axios = require('axios');
const Config = require('../../config');

const STEAM_API_BASE = 'https://api.steampowered.com';

/* Steam persona states */
const PERSONA_STATES = {
    0: { name: 'Offline', emoji: '🔴' },
    1: { name: 'Online', emoji: '🟢' },
    2: { name: 'Busy', emoji: '🚫' },
    3: { name: 'Away', emoji: '🟡' },
    4: { name: 'Snooze', emoji: '🟠' },
    5: { name: 'Looking to Trade', emoji: '🟢' },
    6: { name: 'Looking to Play', emoji: '🟢' }
};

/**
 * Get player summaries from Steam API
 * @param {string|string[]} steamIds - Single Steam ID or array of Steam IDs (max 100)
 * @returns {Promise<Object>} - Object mapping steamId to player data
 */
async function getPlayerSummaries(steamIds) {
    if (!Config.steam.apiKey) {
        return {};
    }

    const ids = Array.isArray(steamIds) ? steamIds : [steamIds];
    if (ids.length === 0) return {};

    try {
        const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/`;
        const response = await Axios.get(url, {
            params: {
                key: Config.steam.apiKey,
                steamids: ids.join(',')
            },
            timeout: 10000
        });

        if (response.status !== 200 || !response.data?.response?.players) {
            return {};
        }

        const result = {};
        for (const player of response.data.response.players) {
            result[player.steamid] = {
                personaName: player.personaname,
                personaState: player.personastate,
                personaStateInfo: PERSONA_STATES[player.personastate] || PERSONA_STATES[0],
                profileUrl: player.profileurl,
                avatar: player.avatarfull,
                gameId: player.gameid || null,
                gameExtraInfo: player.gameextrainfo || null, /* Current game name if playing */
                lastLogOff: player.lastlogoff || null
            };
        }

        return result;
    }
    catch (e) {
        return {};
    }
}

/**
 * Get Steam status for a single player
 * @param {string} steamId - Steam ID
 * @returns {Promise<Object|null>} - Player status info or null
 */
async function getPlayerStatus(steamId) {
    const summaries = await getPlayerSummaries(steamId);
    return summaries[steamId] || null;
}

/**
 * Get persona state info
 * @param {number} state - Persona state number
 * @returns {Object} - State info with name and emoji
 */
function getPersonaStateInfo(state) {
    return PERSONA_STATES[state] || PERSONA_STATES[0];
}

/**
 * Get a player's friend list from Steam API
 * @param {string} steamId - Steam ID of the player
 * @returns {Promise<string[]|null>} - Array of friend Steam IDs, or null if private/error
 */
async function getFriendList(steamId) {
    if (!Config.steam.apiKey) {
        return null;
    }

    try {
        const url = `${STEAM_API_BASE}/ISteamUser/GetFriendList/v1/`;
        const response = await Axios.get(url, {
            params: {
                key: Config.steam.apiKey,
                steamid: steamId,
                relationship: 'friend'
            },
            timeout: 10000
        });

        if (response.status !== 200 || !response.data?.friendslist?.friends) {
            return null;
        }

        return response.data.friendslist.friends.map(friend => friend.steamid);
    }
    catch (e) {
        /* 401 means private profile, other errors also return null */
        return null;
    }
}

/**
 * Get player bans from Steam API
 * @param {string[]} steamIds - Array of Steam IDs (max 100 per request)
 * @returns {Promise<Object>} - Object mapping steamId to ban data
 */
async function getPlayerBans(steamIds) {
    if (!Config.steam.apiKey || !steamIds || steamIds.length === 0) {
        return {};
    }

    try {
        const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerBans/v1/`;
        const response = await Axios.get(url, {
            params: {
                key: Config.steam.apiKey,
                steamids: steamIds.join(',')
            },
            timeout: 10000
        });

        if (response.status !== 200 || !response.data?.players) {
            return {};
        }

        const result = {};
        for (const player of response.data.players) {
            result[player.SteamId] = {
                communityBanned: player.CommunityBanned,
                vacBanned: player.VACBanned,
                numberOfVACBans: player.NumberOfVACBans,
                daysSinceLastBan: player.DaysSinceLastBan,
                numberOfGameBans: player.NumberOfGameBans,
                economyBan: player.EconomyBan
            };
        }

        return result;
    }
    catch (e) {
        return {};
    }
}

/**
 * Get friends with bans for a player
 * @param {string} steamId - Steam ID of the player
 * @returns {Promise<Object>} - Object with isPrivate, totalFriends, friendsWithBans
 */
async function getFriendsWithBans(steamId) {
    const result = {
        isPrivate: false,
        totalFriends: 0,
        friendsWithBans: []
    };

    /* Get friend list */
    const friends = await getFriendList(steamId);
    if (friends === null) {
        result.isPrivate = true;
        return result;
    }

    result.totalFriends = friends.length;
    if (friends.length === 0) {
        return result;
    }

    /* Batch query bans (100 at a time) */
    const allBans = {};
    for (let i = 0; i < friends.length; i += 100) {
        const batch = friends.slice(i, i + 100);
        const batchBans = await getPlayerBans(batch);
        Object.assign(allBans, batchBans);
    }

    /* Filter to friends with any bans */
    const bannedFriendIds = [];
    for (const [friendId, bans] of Object.entries(allBans)) {
        if (bans.vacBanned || bans.numberOfGameBans > 0 || bans.communityBanned) {
            bannedFriendIds.push(friendId);
        }
    }

    if (bannedFriendIds.length === 0) {
        return result;
    }

    /* Get names for banned friends (batch 100 at a time) */
    const allSummaries = {};
    for (let i = 0; i < bannedFriendIds.length; i += 100) {
        const batch = bannedFriendIds.slice(i, i + 100);
        const batchSummaries = await getPlayerSummaries(batch);
        Object.assign(allSummaries, batchSummaries);
    }

    /* Build final list */
    for (const friendId of bannedFriendIds) {
        const bans = allBans[friendId];
        const summary = allSummaries[friendId];
        result.friendsWithBans.push({
            steamId: friendId,
            name: summary?.personaName || 'Unknown',
            vacBans: bans.numberOfVACBans,
            gameBans: bans.numberOfGameBans,
            communityBanned: bans.communityBanned,
            daysSinceLastBan: bans.daysSinceLastBan
        });
    }

    /* Sort by days since last ban (most recent first) */
    result.friendsWithBans.sort((a, b) => a.daysSinceLastBan - b.daysSinceLastBan);

    return result;
}

/**
 * Get friends who are on the server (by comparing names)
 * @param {string} steamId - Steam ID of the player
 * @param {string[]} serverPlayerNames - Array of player names currently on server
 * @returns {Promise<Object>} - Object with isPrivate and friendsOnServer array
 */
async function getFriendsOnServer(steamId, serverPlayerNames) {
    const result = {
        isPrivate: false,
        friendsOnServer: []
    };

    /* Get friend list */
    const friends = await getFriendList(steamId);
    if (friends === null) {
        result.isPrivate = true;
        return result;
    }

    if (friends.length === 0 || serverPlayerNames.length === 0) {
        return result;
    }

    /* Get all friend names (batch 100 at a time) */
    const allSummaries = {};
    for (let i = 0; i < friends.length; i += 100) {
        const batch = friends.slice(i, i + 100);
        const batchSummaries = await getPlayerSummaries(batch);
        Object.assign(allSummaries, batchSummaries);
    }

    /* Compare friend names with server player names (case-insensitive) */
    const serverNamesLower = serverPlayerNames.map(name => name.toLowerCase());
    for (const [friendId, summary] of Object.entries(allSummaries)) {
        if (summary?.personaName) {
            const friendNameLower = summary.personaName.toLowerCase();
            if (serverNamesLower.includes(friendNameLower)) {
                result.friendsOnServer.push({
                    steamId: friendId,
                    name: summary.personaName
                });
            }
        }
    }

    return result;
}

module.exports = {
    getPlayerSummaries,
    getPlayerStatus,
    getPersonaStateInfo,
    getFriendList,
    getPlayerBans,
    getFriendsWithBans,
    getFriendsOnServer,
    PERSONA_STATES
};
