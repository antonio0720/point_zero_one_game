import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './schemas/device.schema';
import { RecoveryCode, RecoveryCodeDocument } from './schemas/recovery-code.schema';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class IdentityRecoveryService {
constructor(
@InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
@InjectModel(RecoveryCode.name) private recoveryCodeModel: Model<RecoveryCodeDocument>,
) {}

async createRecoveryCodeForDevice(deviceId: string): Promise<string> {
const device = await this.deviceModel.findById(deviceId);

if (!device) {
throw new NotFoundException('Device not found');
}

const code = bcrypt.hashSync(Math.random().toString(), 10);
const recoveryCode = await this.recoveryCodeModel.create({ device: device._id, code });

return recoveryCode.code;
}

async recoverIdentityByRecoveryCode(code: string): Promise<Device> {
const recoveryCode = await this.recoveryCodeModel.findOne({ code }).exec();

if (!recoveryCode) {
throw new NotFoundException('Recovery Code not found');
}

const device = await this.deviceModel.findById(recoveryCode.device);

if (!device) {
throw new NotFoundException('Device not found');
}

return device;
}
}
