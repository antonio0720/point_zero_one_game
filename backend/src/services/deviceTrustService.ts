import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DeviceTrustService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async incrementDeviceTrust(deviceId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO device_trust (device_id, trust_score, updated_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (device_id) DO UPDATE SET trust_score = device_trust.trust_score + 1, updated_at = NOW()`,
      [deviceId],
    );
  }

  async getDeviceTrust(deviceId: string): Promise<number> {
    const rows = await this.db.query(
      `SELECT trust_score FROM device_trust WHERE device_id = $1`, [deviceId],
    );
    return rows[0]?.trust_score ?? 0;
  }
}
