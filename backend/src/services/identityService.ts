/**
 * Identity Service — resolves player identity from token claims.
 * Supports both NestJS DI and plain instantiation.
 */
import { DataSource } from 'typeorm';

export interface Identity {
  id: string;
  deviceId: string;
  email: string | null;
  isGuest: boolean;
}

export class IdentityService {
  private db: DataSource | null;

  constructor(db?: DataSource) {
    this.db = db ?? null;
  }

  async getById(identityId: string): Promise<Identity | null> {
    if (!this.db) return null;
    const rows = await this.db.query(
      `SELECT id, device_id as "deviceId", email, is_guest as "isGuest"
       FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
      [identityId],
    );
    return rows[0] ?? null;
  }
}
