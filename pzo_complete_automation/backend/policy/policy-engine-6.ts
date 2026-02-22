import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from './policy.entity';

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

async findPolicyById(id: number): Promise<Policy | null> {
return this.policyRepository.findOne(id);
}

async updatePolicy(id: number, updates: any): Promise<Policy | null> {
const policy = await this.findPolicyById(id);
if (policy) {
Object.assign(policy, updates);
return this.policyRepository.save(policy);
}
return null;
}

async deletePolicy(id: number): Promise<void> {
await this.policyRepository.delete(id);
}
}
