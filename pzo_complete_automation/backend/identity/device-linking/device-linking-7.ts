import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeviceLinkingDocument, DeviceLinking } from './schemas/device-linking.schema';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DeviceLinkingService {
constructor(
@InjectModel(DeviceLinking.name) private deviceLinkingModel: Model<DeviceLinkingDocument>,
private jwtService: JwtService,
) {}

async createDeviceLinkingToken(userId: string): Promise<string> {
const token = this.jwtService.sign({ userId });
return token;
}

async linkDevice(deviceId: string, token: string): Promise<void> {
const decoded = this.jwtService.verify(token);
const userId = decoded.userId as string;

const existingLinking = await this.deviceLinkingModel.findOne({ deviceId, userId });
if (existingLinking) throw new Error('Device already linked to this account.');

const linkingCode = crypto.createHash('md5').update(uuidv4()).digest('hex').slice(0, 16);
const newLinking = await this.deviceLinkingModel.create({ deviceId, userId, linkingCode });

return;
}

async recoverDevice(linkingCode: string): Promise<string | null> {
const deviceLinking = await this.deviceLinkingModel.findOne({ linkingCode });
if (!deviceLinking) return null;

return this.jwtService.sign({ userId: deviceLinking.userId });
}
}
