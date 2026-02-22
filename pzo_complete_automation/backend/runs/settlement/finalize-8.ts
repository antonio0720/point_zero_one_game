import { Injectable } from '@nestjs/common';
import { SettlementEntity } from './entities/settlement.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class FinalizeSettlementService {
constructor(
@InjectRepository(SettlementEntity)
private readonly settlementRepository: Repository<SettlementEntity>,
) {}

async execute(settlementId: number): Promise<void> {
const settlement = await this.settlementRepository.findOneBy({ id: settlementId });

if (!settlement) {
throw new Error('Settlement not found');
}

// Implement your finalization logic here

// Mark the settlement as finalized
settlement.isFinalized = true;

await this.settlementRepository.save(settlement);
}
}
