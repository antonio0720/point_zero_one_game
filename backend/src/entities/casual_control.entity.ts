/**
 * CasualControl entity — PostgreSQL via TypeORM.
 * Replaces mongoose CasualControl model.
 * Handles dedup, rate-limiting, plausibility caps for casual ladder.
 */

import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('casual_controls')
@Index('idx_casual_controls_player', ['playerId'])
export class CasualControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, name: 'player_id' })
  playerId: string;

  @Column({ type: 'varchar', length: 128 })
  action: string;

  @Column({ type: 'timestamptz', name: 'last_executed', default: () => 'NOW()' })
  lastExecuted: Date;
}
