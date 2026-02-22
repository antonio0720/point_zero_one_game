import { Injectable } from '@nestjs/common';
import { Ban, User } from './entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ModerationService {
constructor(
@InjectRepository(User)
private userRepository: Repository<User>,
@InjectRepository(Ban)
private banRepository: Repository<Ban>,
) {}

async issueWarning(userId: string, moderatorId: string): Promise<void> {
const user = await this.userRepository.findOneOrFail({ where: { id: userId } });

if (!user.warningCount) {
user.warningCount = 0;
}

user.warningCount++;
await this.userRepository.save(user);

console.log(`User ${userId} has been issued a warning by moderator ${moderatorId}.`);
}

async banUser(userId: string, reason: string, duration: number): Promise<void> {
const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
const ban = new Ban();
ban.id = uuidv4();
ban.userId = user.id;
ban.reason = reason;
ban.expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000); // duration in hours
ban.createdAt = new Date();

await this.banRepository.save(ban);

console.log(`User ${userId} has been banned for ${duration} hours with reason: ${reason}`);
}
}
