import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface EarnVsSink { earn: number; sink: number; }
export interface StoreStagnation { storeId: string; stagnationPeriod: number; }
export interface RewardInflationWarning { rewardType: string; inflationRate: number; }

@Injectable()
export class EconomySinkRollupsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async compute(): Promise<{
    earnVsSink: EarnVsSink[];
    storeStagnation: StoreStagnation[];
    rewardInflationWarning: RewardInflationWarning[];
  }> {
    return { earnVsSink: [], storeStagnation: [], rewardInflationWarning: [] };
  }
}
