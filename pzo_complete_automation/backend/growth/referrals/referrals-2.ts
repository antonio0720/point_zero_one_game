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
const referral = this.referralRepository.create(createReferralDto);
return this.referralRepository.save(referral);
}

async findReferralByCode(code: string): Promise<Referral | null> {
return this.referralRepository.findOne({ where: { code } });
}

async updateReferral(id: number, referral: Partial<Referral>): Promise<Referral> {
const referralToUpdate = await this.referralRepository.preload('referredUser', { id });
Object.assign(referralToUpdate, referral);
return this.referralRepository.save(referralToUpdate);
}
}
