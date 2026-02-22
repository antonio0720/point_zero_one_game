import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
constructor(private readonly userModel: Model<UserDocument>) {}

async register(email: string, password: string) {
const hashedPassword = await bcrypt.hash(password, 10);
const newUser = new this.userModel({ email, password: hashedPassword });
await newUser.save();
return this.createToken(newUser._id);
}

async login(email: string, password: string) {
const user = await this.userModel.findOne({ email });
if (!user || !(await bcrypt.compare(password, user.password))) {
throw new Error('Invalid credentials');
}
return this.createToken(user._id);
}

private createToken(userId: string) {
const jwt = new JwtService({ secret: 'your-secret-key' });
return jwt.sign({ userId });
}
}

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { RedisClient } from 'redis';
import { Client } from 'sns';

@Injectable()
export class SyncService implements OnApplicationBootstrap {
private redis: RedisClient;
private sns: Client;

constructor(private readonly redisClient: RedisClient, private readonly snsClient: Client) {
this.redis = redisClient;
this.sns = snsClient;
}

async onApplicationBootstrap() {
// Set up sync process here
}

async syncDevice(deviceId: string, token: string) {
const userId = this.getUserIdFromToken(token);
await this.redis.set(deviceId, userId);
await this.sendSyncNotification(userId);
}

private getUserIdFromToken(token: string): string {
const decoded = JSON.parse(CryptoJS.AES.decrypt(token, 'your-secret-key').toString(CryptoJS.enc.Utf8));
return decoded.userId;
}

private sendSyncNotification(userId: string) {
// Send a notification to the user's registered devices for sync
}
}
