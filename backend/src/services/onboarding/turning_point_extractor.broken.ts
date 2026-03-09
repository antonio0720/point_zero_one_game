/**
 * Turning Point Extractor Service
 */

import { Injectable } from '@nestjs/common';
import { EventStream } from './event-stream.interface';

/**
 * Represents a pivotal turn anchor for replay deep-link in the game.
 */
export interface TurningPoint {
  /**
   * The unique identifier of the turning point.
   */
  id: string;

  /**
   * The index of the event that marks the turning point in the event stream.
   */
  eventIndex: number;
}

/**
 * Extracts the pivotal turn anchor for replay deep-link from an event stream.
 */
@Injectable()
export class TurningPointExtractor {
  /**
   * Extracts the turning point from the given event stream.
   *
   * @param eventStream The event stream to extract the turning point from.
   * @returns The turning point, or null if not found.
   */
  public extractTurningPoint(eventStream: EventStream): TurningPoint | null {
    // Implement the logic for extracting the turning point here.
    // This is a placeholder and should be replaced with your implementation.
    return null;
  }
}
