import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appeal, User, Ban, AbuseReport } from './entities';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AppealsService {
constructor(
@InjectRepository(Appeal)
private readonly appealRepository: Repository<Appeal>,

@InjectRepository(User)
private readonly userRepository: Repository<User>,

@InjectRepository(Ban)
private readonly banRepository: Repository<Ban>,

@InjectRepository(AbuseReport)
private readonly abuseReportRepository: Repository<AbuseReport>,
) {}

async createAppeal(userId: string, reason: string): Promise<Appeal> {
const user = await this.userRepository.findOneBy({ id: userId });
if (!user) throw new Error('User not found');

const ban = await this.banRepository.findOneBy({ userId });
if (!ban) throw new Error('No ban found for the user');

const appeal = this.appealRepository.create({
id: uuidv4(),
userId,
reason,
status: 'pending',
});

await this.appealRepository.save(appeal);
return appeal;
}

async updateAppealStatus(appealId: string, status: string): Promise<void> {
const appeal = await this.appealRepository.findOneBy({ id: appealId });
if (!appeal) throw new Error('No appeal found with given ID');

appeal.status = status;
await this.appealRepository.save(appeal);
}

async getAppealsForUser(userId: string): Promise<Appeal[]> {
return this.appealRepository.find({ where: { userId } });
}

async getAllAppeals(): Promise<Appeal[]> {
return this.appealRepository.find();
}

async deleteAppeal(appealId: string): Promise<void> {
const appeal = await this.appealRepository.findOneBy({ id: appealId });
if (!appeal) throw new Error('No appeal found with given ID');

await this.abuseReportRepository.delete({ appealId }); // delete associated abuse reports
await this.banRepository.delete({ userId: appeal.userId }); // remove the ban if appeal is approved
await this.appealRepository.remove(appeal);
}
}
