import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum RevenueShareType {
  VERIFIED_ENGAGEMENT = 'verified_engagement',
}

@Entity('revenue_shares')
export class RevenueShareEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 64, default: RevenueShareType.VERIFIED_ENGAGEMENT }) type: string;
  @Column({ name: 'episode_id' }) episodeId: number;
  @Column({ name: 'user_id' }) userId: number;
  @Column({ type: 'double precision', default: 0 }) revenue: number;
  @Column({ type: 'double precision', name: 'fraud_risk_score', default: 0 }) fraudRiskScore: number;
  @Column({ type: 'varchar', length: 32, name: 'payout_status', default: 'eligible' }) payoutStatus: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class RevShareCalculatorService {
  constructor(
    @InjectRepository(RevenueShareEntity)
    private readonly repo: Repository<RevenueShareEntity>,
  ) {}

  async calculateAndSaveRevShare(
    episodeId: number, userId: number, revenue: number, fraudRiskScore: number,
  ): Promise<void> {
    const payoutStatus = fraudRiskScore > 0.7 ? 'ineligible' : 'eligible';
    await this.repo.save(this.repo.create({
      type: RevenueShareType.VERIFIED_ENGAGEMENT,
      episodeId, userId, revenue, fraudRiskScore, payoutStatus,
    }));
  }
}
