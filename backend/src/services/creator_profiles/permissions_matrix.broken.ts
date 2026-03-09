/**
 * Permissions Matrix Service for Creator Profiles
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { PermissionDocument } from './permission.model';

/**
 * Permission Interface
 */
export interface Permission extends Document {
  level: string;
  publishType: string;
  canPublish: boolean;
}

/**
 * Permissions Matrix Service
 */
@Injectable()
export class PermissionsMatrixService {
  constructor(
    @InjectModel('Permission') private permissionModel: Model<PermissionDocument>,
  ) {}

  async findOneByLevelAndPublishType(level: string, publishType: string): Promise<Permission | null> {
    return this.permissionModel.findOne({ level, publishType }).exec();
  }

  async createOrUpdate(level: string, publishType: string, canPublish: boolean): Promise<void> {
    const permission = await this.findOneByLevelAndPublishType(level, publishType);

    if (!permission) {
      const newPermission = new this.permissionModel({ level, publishType, canPublish });
      await newPermission.save();
    } else {
      permission.canPublish = canPublish;
      await permission.save();
    }
  }
}
