import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('season0_iab')
export class Season0IAB {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 16, name: 'player_id', unique: true })
  playerId: string;

  /**
   * Full IdentityArtifactBundle stored as JSONB.
   * Shape: { badge, emblem, insignia, medallion, seal }
   * Each component: { id, name, description, imageUrl }
   */
  @Column({ type: 'jsonb' })
  bundle: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
