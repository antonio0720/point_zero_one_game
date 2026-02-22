/**
 * RemoteConfig service for managing flags, experiments, and segmentation.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * RemoteConfig entity representing a configuration flag or experiment.
 */
export class RemoteConfigEntity {
  id: number;
  key: string;
  value: string;
  description?: string;
}

/**
 * RemoteConfig service interface for managing configurations.
 */
export interface IRemoteConfigService {
  getFlag(key: string): Promise<string | null>;
  setFlag(key: string, value: string): Promise<void>;
}

/**
 * RemoteConfig service implementation using TypeORM for database access.
 */
@Injectable()
export class RemoteConfigService implements IRemoteConfigService {
  constructor(
    @InjectRepository(RemoteConfigEntity)
    private readonly remoteConfigRepository: Repository<RemoteConfigEntity>,
  ) {}

  async getFlag(key: string): Promise<string | null> {
    const config = await this.remoteConfigRepository.findOne({ where: { key } });
    return config ? config.value : null;
  }

  async setFlag(key: string, value: string): Promise<void> {
    const config = await this.remoteConfigRepository.findOne({ where: { key } });

    if (!config) {
      await this.remoteConfigRepository.save(this.remoteConfigRepository.create({ key, value }));
    } else {
      config.value = value;
      await this.remoteConfigRepository.save(config);
    }
  }
}
