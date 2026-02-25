/**
 * Snapshot Builder Service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailySnapshot, DailySnapshotDocument } from './schemas/daily-snapshot.schema';

/**
 * Interface for the daily snapshot document.
 */
export interface IDailySnapshot {
  date: Date;
  notes?: string;
  drilldownLinks?: string[];
}

/**
 * Service for building and storing daily snapshots of the ops board.
 */
@Injectable()
export class SnapshotBuilderService {
  constructor(
    @InjectModel(DailySnapshot.name) private readonly dailySnapshotModel: Model<DailySnapshotDocument>,
  ) {}

  /**
   * Builds a new daily snapshot object with the given data and saves it to the database.
   *
   * @param {IDailySnapshot} data - The data for the new daily snapshot.
   */
  async createSnapshot(data: IDailySnapshot): Promise<DailySnapshotDocument> {
    const snapshot = new this.dailySnapshotModel(data);
    return snapshot.save();
  }
}

/**
 * Mongoose schema for the daily snapshots collection.
 */
const DailySnapshotSchema = new mongoose.Schema<DailySnapshotDocument>({
  date: { type: Date, required: true },
  notes: String,
  drilldownLinks: [{ type: String }],
});

/**
 * Indexes and foreign keys for the daily snapshots collection.
 */
DailySnapshotSchema.index({ date: 1 });
DailySnapshotSchema.index({ 'drilldownLinks': 1 }, { sparse: true });

export default DailySnapshotSchema;

-- Create the daily_snapshots table if it doesn't exist
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  notes TEXT,
  drilldown_links JSON DEFAULT '[]',
  FOREIGN KEY (drilldown_links) REFERENCES drilldowns(id) ON DELETE CASCADE
);

#!/bin/bash
set -euo pipefail

echo "Creating daily_snapshots table"
psql -f create_daily_snapshots.sql pointzeroonedigital

echo "Building and saving a new snapshot"
node backend/src/services/liveops/ops_board/snapshot_builder.js --data '{"date": "2023-01-01", "notes": "Initial snapshot", "drilldownLinks": ["https://example.com"]}'

apiVersion: v1
kind: ServiceAccount
metadata:
  name: snapshot-builder
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: snapshot-builder-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: snapshot-builder
      environment: production
  template:
    metadata:
      labels:
        app: snapshot-builder
        environment: production
    spec:
      containers:
      - name: snapshot-builder
        image: pointzeroonedigital/snapshot-builder:latest
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: snapshot-builder-config
