import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cohort } from './cohort.entity';

@Entity('pack_assignments')
export class PackAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cohort_id' })
  cohortId: number;

  @Column({ name: 'pack_id' })
  packId: number;

  @Column({ type: 'timestamptz', name: 'starts_at', nullable: true })
  startsAt?: Date;

  @Column({ type: 'timestamptz', name: 'ends_at', nullable: true })
  endsAt?: Date;

  /** Soft-delete / deactivation flag — used by 409 dedup check */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relations ────────────────────────────────────────────────────────────

  @ManyToOne(() => Cohort, (c) => c.packAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cohort_id' })
  cohort?: Cohort;
}
