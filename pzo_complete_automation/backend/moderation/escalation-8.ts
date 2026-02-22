import { Injectable } from '@nestjs/common';
import { Ban, User } from './entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';

@Injectable()
export class EscalationService {
constructor(
@InjectRepository(User)
private readonly userRepository: Repository<User>,

@InjectRepository(Ban)
private readonly banRepository: Repository<Ban>
) {}

async issueWarning(userId: number, reason: string): Promise<void> {
await this.userRepository.update(userId, { warningCount: (prev) => prev + 1 });
console.log(`User ${userId} issued a warning for ${reason}`);
}

async muteUser(userId: number, duration: moment.Duration): Promise<void> {
const user = await this.userRepository.findOne(userId);
if (!user) throw new Error('User not found');

await this.userRepository.update(userId, { mutedUntil: moment().add(duration).toDate() });
console.log(`User ${userId} muted for ${duration.asMinutes()} minutes`);
}

async banUser(userId: number, reason: string): Promise<void> {
const user = await this.userRepository.findOne(userId);
if (!user) throw new Error('User not found');

await this.banRepository.save({
userId,
banReason: reason,
createdAt: new Date(),
expiresAt: null
});
console.log(`User ${userId} banned for ${reason}`);
}

async unbanUser(userId: number): Promise<void> {
await this.banRepository.delete({ userId });
console.log(`User ${userId} unbanned`);
}
}
