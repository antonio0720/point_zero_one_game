/**
 * Guest Sessions Service — PostgreSQL via TypeORM.
 * Replaces mongoose guest_sessions.ts
 *
 * Handles guest session creation, device fingerprinting,
 * upgrade path to full account, and run history preservation.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestSession } from '../../entities/guest_session.entity';

export interface DeviceFingerprint {
  userAgent: string;
  ipAddress: string;
}

@Injectable()
export class GuestSessionsService {
  constructor(
    @InjectRepository(GuestSession)
    private readonly repo: Repository<GuestSession>,
  ) {}

  async create(fingerprint: DeviceFingerprint): Promise<GuestSession> {
    const session = this.repo.create({
      deviceUa: fingerprint.userAgent,
      deviceIp: fingerprint.ipAddress,
      runHistory: [],
    });
    return this.repo.save(session);
  }

  async findById(id: string): Promise<GuestSession | null> {
    return this.repo.findOneBy({ id });
  }

  async appendRunHistory(id: string, runEntry: unknown): Promise<GuestSession | null> {
    const session = await this.repo.findOneBy({ id });
    if (!session) return null;

    session.runHistory = [...(session.runHistory as unknown[]), runEntry];
    return this.repo.save(session);
  }

  async upgradeToAccount(guestId: string, accountId: string): Promise<GuestSession | null> {
    const session = await this.repo.findOneBy({ id: guestId });
    if (!session) return null;

    session.upgradedToId = accountId;
    return this.repo.save(session);
  }
}
