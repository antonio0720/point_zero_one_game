import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from './referral.entity';
import { CreateReferralDto } from './dto/create-referral.dto';

@Injectable()
export class ReferralsService {
constructor(
@InjectRepository(Referral)
private referralRepository: Repository<Referral>,
) {}

async createReferral(createReferralDto: CreateReferralDto): Promise<Referral> {
const newReferral = this.referralRepository.create(createReferralDto);
return this.referralRepository.save(newReferral);
}

async findReferralById(id: number): Promise<Referral | null> {
return this.referralRepository.findOne(id);
}

async updateReferralStatus(id: number, status: string): Promise<void> {
await this.referralRepository.update(id, { status });
}
}
