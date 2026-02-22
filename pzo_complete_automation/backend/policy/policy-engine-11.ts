import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PolicyEngineService {
constructor(
@InjectRepository(Policy)
private policyRepository: Repository<Policy>,
) {}

async createPolicy(policyData: any): Promise<Policy> {
const newPolicy = this.policyRepository.create(policyData);
return this.policyRepository.save(newPolicy);
}

async getPolicyById(id: number): Promise<Policy | null> {
return this.policyRepository.findOneBy({ id });
}

async updatePolicy(id: number, updates: any): Promise<void> {
await this.policyRepository.update(id, updates);
}

async deletePolicy(id: number): Promise<void> {
await this.policyRepository.delete(id);
}
}

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Policy {
@PrimaryGeneratedColumn()
id: number;

@Column({ type: 'json' })
data: any;
}
