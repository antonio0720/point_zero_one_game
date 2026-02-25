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

-- Run Explorer collection schema
CREATE TABLE IF NOT EXISTS run_explorer (
  _id ObjectId PRIMARY KEY,
  run_id VARCHAR(255) NOT NULL,
  proof_hash VARCHAR(255) NOT NULL,
  -- Additional game-specific fields as needed
);

-- Indexes for run_explorer collection
CREATE INDEX IF NOT EXISTS idx_run_explorer_run_id ON run_explorer (run_id);
CREATE INDEX IF NOT EXISTS idx_run_explorer_proof_hash ON run_explorer (proof_hash);

#!/bin/sh
set -euo pipefail

echo "Creating Run Explorer database and collection"
mongo $URL --quiet <<EOF
use $DBNAME;
db.createCollection("run_explorer", { validator: { $jsonSchema: { bsonType: "object", required: ["run_id", "proof_hash"], properties: { _id: { bsonType: "objectId" }, run_id: { bsonType: "string" }, proof_hash: { bsonType: "string" } } } });
EOF

echo "Creating indexes for run_explorer collection"
mongo $URL --quiet <<EOF
use $DBNAME;
db.runCommand({ createIndexes: "run_explorer", indexes: [ { key: { _id: 1 }, name: "idx_run_explorer__id" }, { key: { run_id: 1 }, name: "idx_run_explorer_run_id" }, { key: { proof_hash: 1 }, name: "idx_run_explorer_proof_hash" } ] });
EOF

provider = "aws"
region = "us-west-2"

data = {
  vpc_id = module.vpc.vpc_id
}

resource "aws_security_group" "run_explorer_api" {
  name        = "run_explorer_api"
  description = "Security group for Run Explorer API"
  vpc_id      = data.vpc_id

  ingress {
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "run_explorer_api" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = var.key_name
  security_groups = [aws_security_group.run_explorer_api.name]

  user_data = templatefile("${path.module}/user-data.sh", {
    db_url     = aws_rds_cluster.point_zero_one_digital.endpoint,
    db_name    = aws_db_instance.point_zero_one_digital.database_name,
  })
}
