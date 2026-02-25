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

export type RosterImportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type RosterImportFormat  = 'csv' | 'json';

@Entity('roster_imports')
export class RosterImport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cohort_id' })
  cohortId: number;

  @Column({ type: 'varchar', length: 2048, name: 'file_url' })
  fileUrl: string;

  @Column({
    type: 'varchar',
    length: 8,
    default: 'csv',
  })
  format: RosterImportFormat;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  status: RosterImportStatus;

  /** Set to NOW() at request time; actual processing happens async via BullMQ */
  @Column({ type: 'timestamptz', name: 'imported_at', nullable: true })
  importedAt?: Date;

  /** Number of rows successfully imported (populated by the worker) */
  @Column({ name: 'imported_count', nullable: true })
  importedCount?: number;

  /** Error message if status === 'failed' */
  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relations ────────────────────────────────────────────────────────────

  @ManyToOne(() => Cohort, (c) => c.rosterImports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cohort_id' })
  cohort?: Cohort;
}
