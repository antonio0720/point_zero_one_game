import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getConnection } from 'typeorm';
import { ReferralCode } from './entities/referral-code.entity';
import { User } from '../user/entities/user.entity';
import { ReferralRewardService } from './referral-reward.service';

@Injectable()
export class ReferralsService {
constructor(
@InjectRepository(ReferralCode)
private readonly referralCodeRepository: Repository<ReferralCode>,

@InjectRepository(User)
private readonly userRepository: Repository<User>,

private readonly referralRewardService: ReferralRewardService,
) {}

async createReferralCode(userId: number): Promise<ReferralCode> {
const referralCode = this.referralCodeRepository.create({
userId,
});

await this.referralCodeRepository.save(referralCode);
return referralCode;
}

async applyReferralCode(code: string, userId: number): Promise<void> {
const existingReferralCode = await this.referralCodeRepository.findOne({
where: { code },
relations: ['user'],
});

if (!existingReferralCode) {
throw new Error('Invalid referral code');
}

if (existingReferralCode.userId === userId) {
throw new Error('You cannot use your own referral code');
}

const existingUser = await this.userRepository.findOne(userId);
const referredUser = existingReferralCode.user;

if (existingUser && referredUser) {
await this.referralRewardService.awardReferralRewards(
existingUser,
referredUser,
);
}

existingReferralCode.used = true;
await this.referralCodeRepository.save(existingReferralCode);
}
}
