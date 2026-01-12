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

const DiscordMessages = require('./discordMessages.js');
const DiscordTools = require('./discordTools.js');

module.exports = async (client, guild) => {
    const instance = client.getInstance(guild.id);

    await DiscordTools.clearTextChannel(guild.id, instance.channelId.trackers, 100);

    /* Reset legend message ID since channel was cleared */
    instance.trackerLegendMessageId = null;
    client.setInstance(guild.id, instance);

    /* Send legend message first if there are trackers */
    if (Object.keys(instance.trackers).length > 0) {
        await DiscordMessages.sendTrackerLegendMessage(guild.id);
    }

    for (const trackerId in instance.trackers) {
        await DiscordMessages.sendTrackerMessage(guild.id, trackerId);
    }
}