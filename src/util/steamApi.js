/*
    Copyright (C) 2024

    Steam Web API helper for fetching player status information.
*/

const Axios = require('axios');
const Config = require('../../config');

const STEAM_API_BASE = 'https://api.steampowered.com';

/* Steam persona states */
const PERSONA_STATES = {
    0: { name: 'Offline', emoji: '⚫' },
    1: { name: 'Online', emoji: '🟢' },
    2: { name: 'Busy', emoji: '🔴' },
    3: { name: 'Away', emoji: '🟡' },
    4: { name: 'Snooze', emoji: '🟠' },
    5: { name: 'Looking to Trade', emoji: '🔵' },
    6: { name: 'Looking to Play', emoji: '🟣' }
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

module.exports = {
    getPlayerSummaries,
    getPlayerStatus,
    getPersonaStateInfo,
    PERSONA_STATES
};
