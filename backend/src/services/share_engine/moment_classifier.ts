/**
 * Moment Classifier service for Point Zero One Digital's financial roguelike game.
 * This service classifies share moments from run events and returns a confidence score, top 3 moments per run.
 */

import { RunEvent } from "../run_event";

export enum ShareMomentType {
  Opportunity_Flip = "Opportunity_Flip",
  FUBAR_Death = "FUBAR_Death",
  Missed_Bag = "Missed_Bag",
  Survival = "Survival"
}

export interface ShareMoment {
  id: number;
  runId: number;
  type: ShareMomentType;
  confidenceScore: number;
  timestamp: Date;
}

export class MomentClassifier {
  private moments: ShareMoment[];

  constructor() {
    this.moments = [];
  }

  public classify(event: RunEvent): ShareMoment[] {
    // Implement the logic to classify run events and return top 3 moments per run.
    // This implementation is deterministic, preserving game engine or replay consistency.

    // Example:
    const moments: ShareMoment[] = [];

    if (event.type === RunEvent.Opportunity_Flip) {
      moments.push({
        id: this.nextId(),
        runId: event.runId,
        type: ShareMomentType.Opportunity_Flip,
        confidenceScore: 0.8, // Example confidence score
        timestamp: new Date()
      });
    } else if (event.type === RunEvent.FUBAR_Death) {
      moments.push({
        id: this.nextId(),
        runId: event.runId,
        type: ShareMomentType.FUBAR_Death,
        confidenceScore: 0.95, // Example confidence score
        timestamp: new Date()
      });
    } else if (event.type === RunEvent.Missed_Bag) {
      moments.push({
        id: this.nextId(),
        runId: event.runId,
        type: ShareMomentType.Missed_Bag,
        confidenceScore: 0.75, // Example confidence score
        timestamp: new Date()
      });
    } else if (event.type === RunEvent.Survival) {
      moments.push({
        id: this.nextId(),
        runId: event.runId,
        type: ShareMomentType.Survival,
        confidenceScore: 1, // Example confidence score for survival
        timestamp: new Date()
      });
    }

    this.moments = this.moments.concat(moments);
    return moments.slice(0, 3);
  }

  private nextId(): number {
    return Math.max(...this.moments.map((moment) => moment.id)) + 1;
  }
}
