/**
 * Wellness Analytics Service for Point Zero One Digital
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WellnessAnalyticsDocument, WellnessAnalyticsSchema } from './schemas/wellness-analytics.schema';

/**
 * Wellness Analytics Schema
 */
const wellnessAnalyticsSchema = new Mongoose.Schema({
  organizationId: { type: String, required: true },
  survivalRate: { type: Number, required: true },
  failureMode: { type: String, enum: ['Financial', 'Operational', 'Strategic'], required: true },
  riskLiteracyScore: { type: Number, min: 0, max: 100, required: true },
});

/**
 * Wellness Analytics Interface
 */
export interface IWellnessAnalytics {
  organizationId: string;
  survivalRate: number;
  failureMode: string;
  riskLiteracyScore: number;
}

/**
 * Wellness Analytics Document
 */
export type WellnessAnalytics = WellnessAnalyticsDocument & IWellnessAnalytics;

/**
 * Wellness Analytics Service
 */
@Injectable()
export class WellnessAnalyticsService {
  constructor(
    @InjectModel(wellnessAnalyticsSchema.name) private readonly model: Model<WellnessAnalyticsSchema>,
  ) {}

  /**
   * Create a new wellness analytics record for an organization
   * @param {IWellnessAnalytics} analytics - The analytics data to create
   */
  async create(analytics: IWellnessAnalytics): Promise<WellnessAnalytics> {
    return this.model.create(analytics);
  }

  /**
   * Retrieve wellness analytics records for an organization
   * @param {string} organizationId - The ID of the organization to retrieve data for
   */
  async findOneByOrganizationId(organizationId: string): Promise<WellnessAnalytics | null> {
    return this.model.findOne({ organizationId }).exec();
  }

  /**
   * Update wellness analytics records for an organization
   * @param {string} organizationId - The ID of the organization to update data for
   * @param {Partial<IWellnessAnalytics>} updates - The updates to apply
   */
  async updateOneByOrganizationId(organizationId: string, updates: Partial<IWellnessAnalytics>): Promise<void> {
    await this.model.findOneAndUpdate({ organizationId }, updates).exec();
  }
}
```

Please note that the SQL, Bash, YAML/JSON, and Terraform files are not provided as they are not explicitly requested in your message. However, I can certainly help you generate those if needed.

Regarding the game engine or replay determinism, it's important to ensure that any randomness involved is seeded based on a consistent source (such as a timestamp) to maintain determinism when running multiple times or across different instances.
