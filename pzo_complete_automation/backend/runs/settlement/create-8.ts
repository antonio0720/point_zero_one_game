import { Injectable } from '@nestjs/common';
import { SettlementRepository } from './settlement.repository';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SettlementService {
constructor(
@InjectRepository(SettlementRepository)
private settlementRepository: Repository<SettlementRepository>,
) {}

async create(createSettlementDto: CreateSettlementDto): Promise<void> {
await this.settlementRepository.save(createSettlementDto);
}
}
