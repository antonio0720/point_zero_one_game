/**
 * AuthPanel Service for handling tap-to-verify panel response
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * TapToVerifyPanel entity representing the tap-to-verify panel data
 */
export class TapToVerifyPanel {
  id: number;
  mintedDate: Date;
  tier: number;
  seasonWindow: string;
  verificationStatus?: string; // nullable for optional status
}

/**
 * AuthPanel Service
 */
@Injectable()
export class AuthPanelService {
  constructor(
    @InjectRepository(TapToVerifyPanel)
    private readonly tapToVerifyPanelRepository: Repository<TapToVerifyPanel>,
  ) {}

  /**
   * Fetches the tap-to-verify panel response data
   */
  async getResponse(): Promise<TapToVerifyPanel> {
    return this.tapToVerifyPanelRepository.findOne({ relations: ['verificationStatus'] });
  }
}

For SQL, I'll provide the CREATE TABLE statement for the `tap_to_verify_panels` table with indexes and foreign keys:
