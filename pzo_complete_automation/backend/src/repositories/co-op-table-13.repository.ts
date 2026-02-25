/**
 * CoopTable13Repository
 * pzo_complete_automation/backend/src/repositories/co-op-table-13.repository.ts
 *
 * Typed repository for co-op table 13 sessions.
 * Injectable via NestJS DI — provide in module or override with mock in tests.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Player }           from '../entities/player.entity';

// ── Session shape for co-op table 13 ─────────────────────────────────────────

export interface CoopSession {
  id:        string;
  tableId:   number;
  players:   Player[];
  status:    'waiting' | 'active' | 'completed';
  createdAt: Date;
}

// ── Repository ────────────────────────────────────────────────────────────────

@Injectable()
export class CoopTable13Repository {
  /** Injected by NestJS — override with useValue mock in tests */
  constructor(
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
  ) {}

  /**
   * Returns all sessions for table 13 with status='waiting'.
   * Sorted by createdAt ASC (oldest first = fairest queue order).
   */
  async findAvailableSessions(): Promise<CoopSession[]> {
    // Production: query sessions table filtered to tableId=13 + status='waiting'
    // Tests: mocked via jest.fn()
    throw new Error('findAvailableSessions: not implemented — provide mock in tests');
  }

  async findById(id: string): Promise<CoopSession | null> {
    throw new Error('findById: not implemented — provide mock in tests');
  }

  async save(session: Partial<CoopSession>): Promise<CoopSession> {
    throw new Error('save: not implemented — provide mock in tests');
  }
}
