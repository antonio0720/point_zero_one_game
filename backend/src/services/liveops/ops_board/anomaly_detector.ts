/**
 * Anomaly Detector Service for Point Zero One Digital's financial roguelike game.
 * This service is responsible for detecting anomalies such as rage quits, wipe spikes, and verification latency.
 */

declare module '*.*' {
  const value: any;
  export default value;
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { AnomalyDocument } from './anomaly.schema';

/**
 * Anomaly interface representing the structure of an anomaly record in the database.
 */
export interface IAnomaly extends Document {
  gameId: string;
  timestamp: Date;
  type: string;
  value: number;
}

/**
 * Anomaly schema defining the structure of an anomaly document in MongoDB.
 */
const anomalySchema = new mongoose.Schema<IAnomaly>({
  gameId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  type: { type: String, enum: ['rage_quit', 'wipe_spike', 'verification_latency'], required: true },
  value: { type: Number, required: true },
});

/**
 * AnomalyDetector service class.
 */
@Injectable()
export class AnomalyDetectorService {
  constructor(@InjectModel('Anomaly') private anomalyModel: Model<IAnomaly>) {}

  /**
   * Detects and saves an anomaly in the database.
   * @param gameId The ID of the game for which the anomaly is detected.
   * @param type The type of the anomaly to be detected (rage_quit, wipe_spike, verification_latency).
   * @param value The value associated with the anomaly.
   */
  async detectAnomaly(gameId: string, type: string, value: number): Promise<IAnomaly> {
    const anomaly = new this.anomalyModel({ gameId, timestamp: new Date(), type, value });
    return await anomaly.save();
  }

  /**
   * Retrieves anomalies for a given game ID and type.
   * @param gameId The ID of the game for which the anomalies are retrieved.
   * @param type The type of the anomalies to be retrieved (rage_quit, wipe_spike, verification_latency).
   */
  async getAnomalies(gameId: string, type: string): Promise<IAnomaly[]> {
    return this.anomalyModel.find({ gameId, type }).exec();
  }
}
