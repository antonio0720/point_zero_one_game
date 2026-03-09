/**
 * TutorialVariant entity — PostgreSQL via TypeORM.
 * Replaces mongoose TutorialVariant model.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tutorial_variants')
export class TutorialVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, name: 'variant_name', unique: true })
  variantName: string;

  @Column({ type: 'int' })
  seed: number;

  @Column({ type: 'int', name: 'guaranteed_survival_turns', default: 3 })
  guaranteedSurvivalTurns: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 1 })
  weight: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
