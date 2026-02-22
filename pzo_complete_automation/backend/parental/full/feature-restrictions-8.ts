import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface AgeGatedFeatures {
watchVideos: boolean;
chatWithUsers: boolean;
createContent: boolean;
}

@Injectable()
export class FeatureRestrictionsService {
constructor(
private jwtService: JwtService,
@InjectRepository(User)
private userRepository: Repository<User>,
) {}

async isFeatureAccessible(userId: number, feature: keyof AgeGatedFeatures): Promise<boolean> {
const user = await this.userRepository.findOne(userId, { relations: ['ageVerification'] });

if (!user || !user.ageVerified) {
return false;
}

// Assuming a minimum age for accessing certain features (e.g., 13 for chat and content creation)
const isMinor = user.birthDate.getFullYear() - new Date().getFullYear() < 13;

if (isMinor && feature === 'chatWithUsers' || feature === 'createContent') {
return false;
}

// Age gating for watching videos, assuming different access levels based on age
const age = user.birthDate.getFullYear() - new Date().getFullYear();
const isAdult = age >= 18;

if (feature === 'watchVideos') {
return isAdult ? true : this.restrictVideoAccess(age);
}

// Allow all other features not related to age gating or parental controls
return true;
}

private restrictVideoAccess(age: number): boolean {
// Implement rules for restricted video access based on the user's age, e.g., limiting access to kid-friendly content if under 13
const isRestricted = age < 13;
return !isRestricted;
}

async checkJwt(token: string): Promise<number> {
// Assuming a custom JWT containing user ID
const decoded = this.jwtService.verify(token);
return decoded.userId;
}
}
