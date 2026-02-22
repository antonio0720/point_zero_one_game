import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoopContractClause10Entity } from './coop-contract-clause10.entity';
import { CoopContract } from '../coop-contracts/entities/coop-contract.entity';

@Injectable()
export class Clause10Service {
constructor(
@InjectRepository(CoopContractClause10Entity)
private readonly clause10Repository: Repository<CoopContractClause10Entity>,
@InjectRepository(CoopContract)
private readonly coopContractRepository: Repository<CoopContract>,
) {}

async createClause10(contractId: number, terminationNoticePeriod: number): Promise<CoopContractClause10Entity> {
const newClause = this.clause10Repository.create({ contractId, terminationNoticePeriod });
return this.clause10Repository.save(newClause);
}

async findClause10ById(id: number): Promise<CoopContractClause10Entity | undefined> {
return this.clause10Repository.findOneBy({ id });
}

async updateClause10(id: number, terminationNoticePeriod: number): Promise<void> {
await this.clause10Repository.update(id, { terminationNoticePeriod });
}

async deleteClause10(id: number): Promise<void> {
await this.clause10Repository.delete(id);
}

async getClause10ByContractId(contractId: number): Promise<CoopContractClause10Entity[] | undefined> {
return this.clause10Repository.find({ where: { contractId } });
}
}
