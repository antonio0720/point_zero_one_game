/**
 * Service for locating turning point threshold crossing and deriving snippet window around it.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/** Game event document type */
export type EventDocument = Model<EventDocument>;

/** Game event interface */
export interface Event {
  timestamp: Date;
  game_state: string;
}

/**
 * Turning point locator service.
 */
@Injectable()
export class TurningPointLocatorService {
  constructor(
    @InjectModel('Event') private readonly eventModel: EventDocument,
  ) {}

  /**
   * Locates turning point threshold crossing and derives snippet window around it.
   *
   * @param threshold - The game state that marks a turning point.
   */
  async findTurningPoint(threshold: string): Promise<Event[]> {
    // Query for events where the game state is either equal to or changes from the threshold.
    const events = await this.eventModel.find({
      game_state: { $in: [threshold, { $ne: threshold }] },
    })
      .sort('timestamp')
      .exec();

    // Filter out events that are not part of a turning point.
    const turningPoint = events.filter((event, index) => {
      if (index === 0) return event.game_state === threshold;
      return event.game_state !== threshold && events[index - 1].game_state === threshold;
    });

    // Derive snippet window around the turning point.
    const startIndex = turningPoint.findIndex((event) => event.game_state === threshold);
    const endIndex = turningPoint.findIndex((event) => event.game_state !== threshold);
    const snippetWindow = turningPoint.slice(startIndex - 10, startIndex + 11);

    return snippetWindow;
  }
}
