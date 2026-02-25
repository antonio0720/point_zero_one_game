import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Cohort } from './cohort.entity';

@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  domain?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  adminEmail?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Cohort, (cohort) => cohort.institution)
  cohorts?: Cohort[];
}
