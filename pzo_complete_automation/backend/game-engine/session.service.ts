/**
 * SessionService
 * pzo_complete_automation/backend/session.service.ts
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Player }          from './src/entities/player.entity';
import { CreateSessionDto } from './dto/create-session.dto';

export interface Session {
  id:        string;
  tableId:   number;
  players:   Player[];
  status:    'waiting' | 'active' | 'completed';
  createdAt: Date;
}

export interface PlayerUpdate {
  isMatchmaking?:    boolean;
  currentSessionId?: string | null;
}

@Injectable()
export class SessionService {
  async createSession(dto: CreateSessionDto): Promise<Session> {
    throw new Error('createSession: not implemented — provide mock in tests');
  }

  async findById(id: string): Promise<Session> {
    throw new Error('findById: not implemented — provide mock in tests');
  }

  /**
   * Bulk-updates player records with the given patch.
   * Used post-matchmaking to set isMatchmaking=false and bind currentSessionId.
   *
   * @param playerIds  UUIDs of players to update
   * @param update     Fields to patch on each player
   * @returns          Updated player records
   */
  async updatePlayers(
    playerIds: string[],
    update:    PlayerUpdate,
  ): Promise<Player[]> {
    throw new Error('updatePlayers: not implemented — provide mock in tests');
  }
}
