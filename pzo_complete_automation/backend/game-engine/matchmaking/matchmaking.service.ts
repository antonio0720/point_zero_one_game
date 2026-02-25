/**
 * MatchmakingService
 * pzo_complete_automation/backend/matchmaking/matchmaking.service.ts
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSessionDto }              from '../dto/create-session.dto';
import { Session }                       from '../session.service';

export interface FindMatchesQuery {
  tableId: number;
}

@Injectable()
export class MatchmakingService {
  /**
   * Returns available sessions for the given tableId with status='waiting'.
   * Results are scoped strictly to the requested tableId.
   */
  async findAvailableMatches(query: FindMatchesQuery): Promise<Session[]> {
    throw new Error('findAvailableMatches: not implemented — provide mock in tests');
  }

  /**
   * Starts a new co-op session from the given DTO.
   * Throws NotFoundException if:
   *   - No available sessions exist for the tableId
   *   - Insufficient players to meet table minimum (2+)
   *   - Session already started (idempotency guard)
   */
  async startSession(dto: CreateSessionDto): Promise<Session> {
    throw new Error('startSession: not implemented — provide mock in tests');
  }
}
