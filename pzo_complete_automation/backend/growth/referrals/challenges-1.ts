import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Challenge } from './challenge.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ChallengesService {
constructor(
@InjectRepository(Challenge)
private challengeRepository: Repository<Challenge>,
@InjectRepository(User)
private userRepository: Repository<User>,
) {}

async createChallenge(userId: number, title: string, description: string): Promise<Challenge> {
const user = await this.userRepository.findOne(userId);
if (!user) {
throw new Error('User not found');
}

const challenge = this.challengeRepository.create({ title, description });
user.challenges.push(challenge);
await this.userRepository.save(user);
return this.challengeRepository.save(challenge);
}

async getChallengesByUser(userId: number): Promise<Challenge[]> {
const user = await this.userRepository.findOne(userId, { relations: ['challenges'] });
if (!user) {
throw new Error('User not found');
}
return user.challenges;
}
}
