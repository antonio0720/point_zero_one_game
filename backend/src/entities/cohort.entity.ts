import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Institution }    from './institution.entity';
import { PackAssignment } from './pack_assignment.entity';
import { RosterImport }   from './roster_import.entity';

@Entity('cohorts')
export class Cohort {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'institution_id' })
  institutionId: number;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'timestamptz', name: 'start_date', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamptz', name: 'end_date', nullable: true })
  endDate?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ── Relations ────────────────────────────────────────────────────────────

  @ManyToOne(() => Institution, (inst) => inst.cohorts, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'institution_id' })
  institution?: Institution;

  @OneToMany(() => PackAssignment, (pa) => pa.cohort)
  packAssignments?: PackAssignment[];

  @OneToMany(() => RosterImport, (ri) => ri.cohort)
  rosterImports?: RosterImport[];
}
