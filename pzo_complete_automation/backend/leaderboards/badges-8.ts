import { Request, Response } from 'express';
import { MongoClient } from 'mongodb';
import { ObjectId } from 'mongodb';

class BadgeService {
private client: any;
private db: any;
constructor() {
this.client = new MongoClient('mongodb://localhost:27017');
this.connect();
}

async connect() {
await this.client.connect();
this.db = this.client.db('leaderboards-badges');
}

async createBadge(name: string, description?: string) {
const badgeCollection = this.db.collection('badges');
return badgeCollection.insertOne({ name, description });
}

async getBadge(id: ObjectId) {
const badgeCollection = this.db.collection('badges');
const result = await badgeCollection.findOne({ _id: id });
return result;
}

async updateBadge(id: ObjectId, updates: any) {
const badgeCollection = this.db.collection('badges');
await badgeCollection.updateOne({ _id: id }, { $set: updates });
}
}

const service = new BadgeService();

export const getBadgeById = async (req: Request, res: Response) => {
try {
const id = req.params.id;
const result = await service.getBadge(new ObjectId(id));
res.json(result);
} catch (error) {
res.status(500).json({ message: error.message });
}
};

export const createBadge = async (req: Request, res: Response) => {
try {
const name = req.body.name;
const description = req.body.description || '';
const result = await service.createBadge(name, description);
res.json(result.insertedId);
} catch (error) {
res.status(500).json({ message: error.message });
}
};

export const updateBadge = async (req: Request, res: Response) => {
try {
const id = req.params.id;
const updates = req.body;
await service.updateBadge(new ObjectId(id), updates);
res.status(204).send();
} catch (error) {
res.status(500).json({ message: error.message });
}
};
