/**
 * Run Explorer API service module for read-only access to game runs.
 */

import express from 'express';
import { Request, Response } from 'express';
import { MongoClient } from 'mongodb';

// Connection URL and database name
const url = 'mongodb://localhost:27017';
const dbName = 'point_zero_one_digital';

// Initialize Express app and connection to MongoDB
const app = express();
const client = new MongoClient(url);
let db: any;

async function connectToDatabase() {
  if (!db) {
    await client.connect();
    db = client.db(dbName);
  }
}

// Indexes for run_explorer collection
const runExplorerIndexes = [
  { _id: 1 },
  { run_id: 1 },
  { proof_hash: 1 },
];

// Run Explorer API endpoints
app.get('/run/:runId', async (req: Request, res: Response) => {
  const { runId } = req.params;

  await connectToDatabase();
  const collection = db.collection('run_explorer');

  try {
    const result = await collection.findOne({ run_id: runId });
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/proof/:proofHash', async (req: Request, res: Response) => {
  const { proofHash } = req.params;

  await connectToDatabase();
  const collection = db.collection('run_explorer');

  try {
    const result = await collection.findOne({ proof_hash: proofHash });
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Start the server on port 3001
app.listen(3001, () => console.log('Run Explorer API listening on port 3001'));

