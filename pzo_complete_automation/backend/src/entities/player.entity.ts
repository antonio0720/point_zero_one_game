/**
 * Player entity
 * pzo_complete_automation/backend/src/entities/player.entity.ts
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, name: 'display_name' })
  displayName: string;

  @Column({ type: 'boolean', name: 'is_matchmaking', default: false })
  isMatchmaking: boolean;

  @Column({ type: 'uuid', name: 'current_session_id', nullable: true })
  currentSessionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
