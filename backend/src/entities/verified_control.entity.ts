/**
 * VerifiedControl entity — PostgreSQL via TypeORM.
 * Replaces mongoose VerifiedControl schema.
 * Tracks verified ladder placement linkage.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('verified_controls')
@Index('idx_verified_controls_game', ['gameId'])
export class VerifiedControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, name: 'game_id' })
  gameId: string;

  @Column({ type: 'varchar', length: 64, name: 'control_id', unique: true })
  controlId: string;

  @Column({ type: 'varchar', length: 64, name: 'placement_id' })
  placementId: string;

  @Column({ type: 'varchar', length: 64, name: 'verifier_id' })
  verifierId: string;

  @Column({ type: 'timestamptz', name: 'verified_at', default: () => 'NOW()' })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/**
 * PendingPlacement entity — PostgreSQL via TypeORM.
 * Replaces mongoose PendingPlacement model.
 * Tracks placements waiting for verification before global publish.
 */

@Entity('pending_placements')
@Index('idx_pending_placements_owner', ['ownerId'])
@Index('idx_pending_placements_ladder', ['ladderId', 'finalized'])
export class PendingPlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', length: 64, name: 'ladder_id' })
  ladderId: string;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'boolean', name: 'is_visible', default: false })
  isVisible: boolean;

  @Column({ type: 'boolean', default: false })
  finalized: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
