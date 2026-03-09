import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface Identity {
  id: string;
  deviceId: string;
  email: string | null;
  isGuest: boolean;
}

@Injectable()
export class IdentityService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async getById(identityId: string): Promise<Identity | null> {
    const rows = await this.db.query(
      `SELECT id, device_id as "deviceId", email, is_guest as "isGuest"
       FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
      [identityId],
    );
    return rows[0] ?? null;
  }
}
