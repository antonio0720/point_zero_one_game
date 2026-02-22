import { MongoClient } from 'mongodb';
import cron from 'node-cron';

const mongoUrl = 'mongodb://username:password@localhost:27017';
const dbName = 'yourDatabase';
const collectionName = 'yourCollection';
const ttlDays = 30; // TTL in days for the data retention policy

let client: MongoClient;
let db: any;

async function connectToMongo() {
if (!client) {
client = await MongoClient.connect(mongoUrl);
db = client.db(dbName);
}
return db;
}

function getCollection() {
return db[collectionName];
}

async function setupDataRetention() {
const collection = getCollection();
cron.schedule(`0 0 * * ${ttlDays}`, async () => {
console.log(`Running data retention job at ${new Date().toLocaleTimeString()}`);
await collection.deleteMany({ createdAt: { $lt: new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000) } });
});
}

setupDataRetention().catch((error) => console.error(error));
