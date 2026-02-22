import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { MongoClient } from 'mongodb';

const uri = 'mongodb://<your_mongo_connection_string>';
const client = new MongoClient(uri);
let db: any;

client.connect(async () => {
db = client.db('<your_database_name>');
});

interface UserData {
_id: ObjectId;
email: string;
}

async function deleteUserData(email: string) {
const collection = db.collection('users');
return await collection.deleteMany({ email });
}

app.delete('/api/user-data', async (req: Request, res: Response) => {
try {
const email = req.body.email;
if (!email) {
return res.status(400).json({ error: 'Email is required' });
}

const result = await deleteUserData(email);
res.json({ success: true, count: result.deletedCount });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while deleting user data' });
}
});
