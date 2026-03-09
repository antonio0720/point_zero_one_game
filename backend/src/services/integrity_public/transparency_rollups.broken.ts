/**
 * Monthly rollup generator service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RollupDocument, RollupSchema } from './rollups.schema';
import { RedactionRuleDocument, RedactionRuleSchema } from '../redaction-rules/redaction-rules.schema';

/**
 * Monthly rollup generator service for Point Zero One Digital's financial roguelike game.
 */
@Injectable()
export class TransparencyRollupsService {
  constructor(
    @InjectModel('Rollup') private readonly rollupModel: Model<RollupDocument>,
    @InjectModel('RedactionRule') private readonly redactionRuleModel: Model<RedactionRuleDocument>,
  ) {}

  /**
   * Generates a monthly rollup of game data, including totals, percentages, average latency, top reason categories, enforcement counts, and redacted data.
   */
  async generateRollup(): Promise<void> {
    // Query for all game events from the database
    const events = await this.rollupModel.find({});

    // Calculate totals, percentages, average latency, top reason categories, enforcement counts, and redacted data
    const totals = this.calculateTotals(events);
    const percentages = this.calculatePercentages(totals);
    const avgLatency = this.calculateAvgLatency(events);
    const topReasonCategories = this.getTopReasonCategories(events);
    const enforcementCounts = this.calculateEnforcementCounts(events);
    const redactedData = this.redactSensitiveData(events, this.redactionRuleModel.find({}));

    // Create a new rollup document with the calculated data and save it to the database
    const newRollup = new this.rollupModel({
      totals,
      percentages,
      avgLatency,
      topReasonCategories,
      enforcementCounts,
      redactedData,
    });
    await newRollup.save();
  }

  /**
   * Calculates the total values for each category of game events.
   */
  private calculateTotals(events: RollupDocument[]): { [key: string]: number } {
    const totals = {};
    events.forEach((event) => {
      event.categories.forEach((category) => {
        if (!totals[category]) {
          totals[category] = 0;
        }
        totals[category] += event.counts[category];
      });
    });
    return totals;
  }

  /**
   * Calculates the percentage of each category's total game events.
   */
  private calculatePercentages(totals: { [key: string]: number }): { [key: string]: number } {
    const percentages = {};
    Object.keys(totals).forEach((category) => {
      percentages[category] = (totals[category] / this.totalEventCount(events)) * 100;
    });
    return percentages;
  }

  /**
   * Calculates the average latency of all game events.
   */
  private calculateAvgLatency(events: RollupDocument[]): number {
    const latencies = events.map((event) => event.latency);
    return latencies.reduce((sum, current) => sum + current, 0) / events.length;
  }

  /**
   * Returns the top reason categories for game events based on their count.
   */
  private getTopReasonCategories(events: RollupDocument[]): string[] {
    const eventCounts = this.getEventCounts(events);
    return Object.keys(eventCounts).sort((a, b) => eventCounts[b] - eventCounts[a]).slice(0, 5);
  }

  /**
   * Calculates the enforcement counts for each reason category of game events.
   */
  private calculateEnforcementCounts(events: RollupDocument[]): { [key: string]: number } {
    const enforcementCounts = {};
    events.forEach((event) => {
      event.enforcements.forEach((enforcement) => {
        if (!enforcementCounts[enforcement.reason]) {
          enforcementCounts[enforcement.reason] = 0;
        }
        enforcementCounts[enforcement.reason] += 1;
      });
    });
    return enforcementCounts;
  }

  /**
   * Redacts sensitive data from game events based on the provided redaction rules.
   */
  private redactSensitiveData(events: RollupDocument[], redactionRules: RedactionRuleDocument[]): RollupDocument {
    // Apply each redaction rule to the game events and return the redacted data
    const redactedEvents = events.map((event) => {
      const redactedData = event;
      redactionRules.forEach((rule) => {
        if (rule.appliesTo(redactedData)) {
          rule.applyRedaction(redactedData);
        }
      });
      return redactedData;
    });

    // Return the first redacted event as the representative of all redacted data
    return redactedEvents[0];
  }

  /**
   * Returns the total count of game events across all categories.
   */
  private totalEventCount(events: RollupDocument[]): number {
    let total = 0;
    events.forEach((event) => {
      Object.values(event.counts).forEach((count) => {
        total += count;
      });
    });
    return total;
  }
}
