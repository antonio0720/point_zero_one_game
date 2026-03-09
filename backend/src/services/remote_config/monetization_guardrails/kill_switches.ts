import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('kill_switches')
export class KillSwitchEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, unique: true }) name: string;
  @Column({ type: 'boolean', name: 'is_active', default: false }) isActive: boolean;
}

@Injectable()
export class KillSwitchesService {
  constructor(
    @InjectRepository(KillSwitchEntity)
    private readonly repo: Repository<KillSwitchEntity>,
  ) {}

  async getActiveKillSwitches(): Promise<KillSwitchEntity[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  async setKillSwitchActive(name: string): Promise<void> {
    await this.repo.update({ name }, { isActive: true });
  }

  async setKillSwitchInactive(name: string): Promise<void> {
    await this.repo.update({ name }, { isActive: false });
  }
}
