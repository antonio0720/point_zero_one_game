import express from 'express';
import { MongoClient } from 'mongodb';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

const uri = 'mongodb://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority';
const client = new MongoClient(uri);

async function connectDB() {
if (!client.isConnected()) await client.connect();
}

interface UserData {
id: string;
name: string;
email: string;
createdAt: Date;
}

async function findUser(userId: string) {
await connectDB();
const db = client.db('database');
const collection = db.collection<UserData>('users');
return collection.findOne({ _id: userId });
}

async function deleteUser(userId: string) {
const user = await findUser(userId);
if (!user) throw new Error('User not found');

await connectDB();
const db = client.db('database');
const collection = db.collection<UserData>('users');
await collection.deleteOne({ _id: userId });
}

app.post('/delete-user', async (req, res) => {
try {
const { userId } = req.body;
await deleteUser(userId);
res.sendStatus(204);
} catch (error) {
console.error(error);
res.status(500).send({ message: 'An error occurred while processing the request.' });
}
});

app.listen(3000, () => console.log('Server is running on port 3000'));
