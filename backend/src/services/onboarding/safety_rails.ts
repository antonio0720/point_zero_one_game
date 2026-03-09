import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('safety_rails')
export class SafetyRailEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 }) constraint: string;
  @Column({ type: 'boolean', default: false }) enabled: boolean;
}

@Injectable()
export class SafetyRailRepository {
  constructor(
    @InjectRepository(SafetyRailEntity)
    private readonly repo: Repository<SafetyRailEntity>,
  ) {}

  async setConstraint(constraint: string, enabled: boolean): Promise<void> {
    const existing = await this.repo.findOneBy({ constraint });
    if (existing) {
      existing.enabled = enabled;
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({ constraint, enabled }));
    }
  }

  async getConstraint(constraint: string): Promise<boolean> {
    const rail = await this.repo.findOneBy({ constraint });
    return rail?.enabled ?? false;
  }
}

@Injectable()
export class OnboardingService {
  constructor(private readonly safetyRails: SafetyRailRepository) {}

  async isMonetizationSurfacesEnabled(): Promise<boolean> {
    return !(await this.safetyRails.getConstraint('monetizationSurfaces'));
  }

  async isAdvancedSystemsEnabled(): Promise<boolean> {
    return !(await this.safetyRails.getConstraint('advancedSystems'));
  }

  async isLongTutorialsEnabled(): Promise<boolean> {
    return !(await this.safetyRails.getConstraint('longTutorials'));
  }

  async isOverlayVerbosityEnabled(): Promise<boolean> {
    return await this.safetyRails.getConstraint('overlayVerbosity');
  }
}
