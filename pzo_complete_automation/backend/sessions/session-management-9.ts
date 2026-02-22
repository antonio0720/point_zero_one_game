import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Client, Message, TextChannel, VoiceChannel } from 'discord.js';

const app = express();
const PORT = process.env.PORT || 3000;
const client = new Client({ intents: [ 'Guilds', 'GuildVoiceStates' ] });
let sessions: Record<string, SessionData> = {};

client.on('ready', () => {
console.log(`Logged in as ${client.user?.tag}`);
});

client.on('voiceStateUpdate', (oldState, newState) => {
if (!oldState.channelID && newState.channelID) {
const userId = newState.id;
if (!sessions[userId]) sessions[userId] = { channelId: newState.channelID };
}

if (oldState.channelID && !newState.channelID) {
delete sessions[oldState.id];
}
});

app.use(express.json());

app.post('/match', (req, res) => {
const player1 = req.body.player1;
const player2 = req.body.player2;

if (!sessions[player1] || !sessions[player2]) {
return res.status(403).json({ error: 'One or both players are not in a voice channel' });
}

const channelId1 = sessions[player1].channelId;
const channelId2 = sessions[player2].channelId;

if (channelId1 === channelId2) {
return res.status(403).json({ error: 'Players are already in the same voice channel' });
}

const commonChannel = client.channels.cache.find(
(ch: TextChannel | VoiceChannel) => ch.type === 'voice' && Array.from(ch.members.keys()).includes(player1) && Array.from(ch.members.keys()).includes(player2)
);

if (!commonChannel) {
const newChannel = client.channels.create('match-' + uuidv4(), { type: 'voice', parent: commonChannel?.guild.channels.cache.find((c: TextChannel | VoiceChannel) => c.type === 'category') as VoiceChannel });

sessions[player1].channelId = newChannel.id;
sessions[player2].channelId = newChannel.id;
}

res.json({ success: true });
});

app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});
