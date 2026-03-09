/**
 * Device Trust Service — tracks per-device trust scores.
 * Supports both NestJS DI (@InjectDataSource) and plain instantiation.
 */
import { DataSource } from 'typeorm';

export class DeviceTrustService {
  private db: DataSource | null;

  constructor(db?: DataSource) {
    this.db = db ?? null;
  }

  async incrementDeviceTrust(deviceId: string): Promise<void> {
    if (!this.db) return;
    await this.db.query(
      `INSERT INTO device_trust (device_id, trust_score, updated_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (device_id) DO UPDATE
       SET trust_score = device_trust.trust_score + 1, updated_at = NOW()`,
      [deviceId],
    );
  }

  async getDeviceTrust(deviceId: string): Promise<number> {
    if (!this.db) return 0;
    const rows = await this.db.query(
      `SELECT trust_score FROM device_trust WHERE device_id = $1`, [deviceId],
    );
    return rows[0]?.trust_score ?? 0;
  }
}
