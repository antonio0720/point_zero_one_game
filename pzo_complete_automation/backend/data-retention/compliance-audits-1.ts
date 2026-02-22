import { createClient } from 'redis';
import { Db, MongoClient } from 'mongodb';
import * as cron from 'node-cron';
import moment from 'moment-timezone';

const redisClient = createClient();
redisClient.on('error', (err) => console.error(`Error connecting to Redis: ${err}`));

let db: Db;
MongoClient.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true }, async (err, client) => {
if (err) console.error(`Error connecting to MongoDB: ${err}`);
db = client.db('compliance-audits');
});

interface UserData {
id: string;
createdAt: Date;
}

async function fetchUserData(): Promise<UserData[]> {
const userData: UserData[] = [];

redisClient.zrangebyscore('users', '-inf', moment().subtract(30, 'days').toISOString(), (err, users) => {
if (err) console.error(`Error fetching users from Redis: ${err}`);

users.forEach((userId) => {
db.collection('users').findOne({ _id: new ObjectId(userId) }, async (err, user) => {
if (!err && user) userData.push(user as UserData);
});
});
});

return userData;
}

async function deleteUserData(userData: UserData): Promise<void> {
db.collection('users').deleteOne({ _id: new ObjectId(userData.id) }, (err, result) => {
if (err) console.error(`Error deleting user ${userData.id} from MongoDB: ${err}`);
else console.log(`User ${userData.id} deleted`);
});

redisClient.del(userData.id, (err) => {
if (err) console.error(`Error deleting user ${userData.id} from Redis: ${err}`);
});
}

cron.schedule('0 0 * * *', async () => {
const userData = await fetchUserData();
for (const data of userData) deleteUserData(data);
});
