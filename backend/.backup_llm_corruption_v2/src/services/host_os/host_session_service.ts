/**
 * Host Session Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameSession, GameSessionDocument } from './game-session.model';
import { MomentCapture, MomentCaptureDocument } from '../moment-capture/moment-capture.model';
import { RetentionAnalyticsService } from '../retention-analytics/retention-analytics.service';

/**
 * Host Session Service Interface
 */
export interface IHostSessionService {
  createHostSession(gameId: string): Promise<GameSession>;
  logMomentCapture(sessionId: string, momentCapture: MomentCapture): Promise<void>;
  trackAttendance(sessionId: string, userId: string): Promise<void>;
  bookNextSession(userId: string): Promise<string>;
  emitHostSessionCompletedEvent(sessionId: string): void;
}

/**
 * Host Session Service Implementation
 */
@Injectable()
export class HostSessionService implements IHostSessionService {
  constructor(
    @InjectModel(GameSession.name) private gameSessionModel: Model<GameSessionDocument>,
    @InjectModel(MomentCapture.name) private momentCaptureModel: Model<MomentCaptureDocument>,
    private retentionAnalyticsService: RetentionAnalyticsService,
  ) {}

  async createHostSession(gameId: string): Promise<GameSession> {
    const session = new this.gameSessionModel({ gameId });
    return await session.save();
  }

  async logMomentCapture(sessionId: string, momentCapture: MomentCapture): Promise<void> {
    await this.momentCaptureModel.create({ sessionId, ...momentCapture });
  }

  async trackAttendance(sessionId: string, userId: string): Promise<void> {
    await this.gameSessionModel.findByIdAndUpdate(sessionId, { $addToSet: { attendees: userId } }, { new: true });
  }

  async bookNextSession(userId: string): Promise<string> {
    const session = await this.gameSessionModel.findOneAndUpdate(
      { 'attendees': userId, status: 'upcoming' },
      { status: 'in-progress' },
      { new: true },
    );

    if (!session) {
      throw new Error('No upcoming session found for the user');
    }

    return session._id.toString();
  }

  emitHostSessionCompletedEvent(sessionId: string): void {
    this.retentionAnalyticsService.emitHostSessionCompletedEvent(sessionId);
  }
}
```

For the SQL, I'll provide a simplified version as it's not included in your request:

```sql
CREATE TABLE IF NOT EXISTS game_sessions (
    id VARCHAR(255) PRIMARY KEY,
    game_id VARCHAR(255),
    status ENUM('upcoming', 'in-progress', 'completed'),
    attendees JSON DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS moment_captures (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255),
    timestamp TIMESTAMP,
    event ENUM('start', 'end'),
    data JSON
);

ALTER TABLE game_sessions ADD FOREIGN KEY (game_id) REFERENCES games(id);
