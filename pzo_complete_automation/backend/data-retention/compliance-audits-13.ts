import { Client, Intents } from 'discord.js';
import { RetentionPolicy, Schedule } from './retention-policy';
import { Database } from './database';
import moment = require('moment-timezone');

const client = new Client({ intents: [Intents.Flags.Guilds] });
const retentionPolicy = new RetentionPolicy(new Database());

client.on('ready', () => {
console.log(`Logged in as ${client.user?.tag}!`);
scheduleTasks();
});

function scheduleTasks() {
setInterval(() => {
retentionPolicy.deleteOldMessages();
}, Schedule.DAILY);

setInterval(() => {
retentionPolicy.checkAndUpdateRetentionPolicy();
}, Schedule.WEEKLY);
}

client.on('messageCreate', async message => {
if (message.author.bot) return;

const guildId = message.guildId!;
const guildRetentionPolicy = await retentionPolicy.getRetentionPolicy(guildId);

// Apply retention policy on a per-message basis
if (!guildRetentionPolicy || moment().isAfter(moment.unix(guildRetentionPolicy.expirationTime))) {
message.delete();
return;
}
});

client.login('YOUR_BOT_TOKEN');
