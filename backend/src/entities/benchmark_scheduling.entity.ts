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

@Entity('benchmark_schedulings')
export class BenchmarkScheduling {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cohort_id' })
  cohortId: number;

  @Column({ type: 'timestamptz', name: 'start_time' })
  startTime: Date;

  @Column({ type: 'timestamptz', name: 'end_time' })
  endTime: Date;

  /** Optional pack this benchmark window targets */
  @Column({ name: 'pack_id', nullable: true })
  packId?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relations ────────────────────────────────────────────────────────────

  @ManyToOne(() => Cohort, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cohort_id' })
  cohort?: Cohort;
}
