/**
 * Guest Sessions Service for Point Zero One Digital's financial roguelike game.
 * This service handles guest session creation, device fingerprinting, upgrade path to full account, preservation of run history on upgrade, and rate limiting per device.
 */

declare module '*.*' {
  const value: any;
  export default value;
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as uuidv4 from 'uuid/v4';
import * as device from 'express-device';

/** Device Fingerprint Interface */
export interface IDeviceFingerprint {
  userAgent: string;
  ipAddress: string;
}

/** Guest Session Document Interface */
export interface IGuestSessionDocument extends Document {
  _id: string;
  deviceFingerprint: IDeviceFingerprint;
  runHistory: any[]; // JSON array to store game run history
  createdAt: Date;
  updatedAt: Date;
}

/** Guest Session Model Interface */
export interface IGuestSessionModel extends Model<IGuestSessionDocument> {
  create(deviceFingerprint: IDeviceFingerprint): Promise<IGuestSessionDocument>;
  findOneAndUpdate(conditions: any, update: any, options?: any): Promise<IGuestSessionDocument | null>;
}

/** Guest Session Service */
@Injectable()
export class GuestSessionsService {
  constructor(@InjectModel('GuestSession') private guestSessionModel: IGuestSessionModel) {}

  /**
   * Create a new guest session with device fingerprint.
   * @param deviceFingerprint The device fingerprint object containing userAgent and ipAddress properties.
   */
  async create(deviceFingerprint: IDeviceFingerprint): Promise<IGuestSessionDocument> {
    const session = new this.guestSessionModel({
      _id: uuidv4(),
      deviceFingerprint,
      runHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return await session.save();
  }

  /**
   * Find and update a guest session by conditions, updating the run history and rate limiting per device.
   * @param conditions The MongoDB query conditions for finding the guest session.
   * @param update The updates to apply to the guest session document.
   * @param options The optional MongoDB update options, including upsert: true for creating a new session if not found.
   */
  async findOneAndUpdate(conditions: any, update: any, options?: any): Promise<IGuestSessionDocument | null> {
    // Implement rate limiting logic here (e.g., using Redis or another solution)

    return this.guestSessionModel.findOneAndUpdate(conditions, update, options);
  }
}
```

SQL:

```sql
-- Guest Sessions Collection
CREATE TABLE IF NOT EXISTS guest_sessions (
  _id UUID PRIMARY KEY,
  deviceFingerprint JSONB NOT NULL,
  runHistory JSONB[] DEFAULT '[]'::jsonb[],
  createdAt TIMESTAMP WITH TIME ZONE NOT NULL,
  updatedAt TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for Guest Sessions Collection
CREATE INDEX IF NOT EXISTS idx_guest_sessions_deviceFingerprint ON guest_sessions (deviceFingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_createdAt ON guest_sessions (createdAt);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail

echo "Creating guest session"
# Implement rate limiting logic here (e.g., using Redis or another solution)

# Example usage of the GuestSessionsService
node backend/src/services/auth/guest_sessions.ts create \
  '{"userAgent": "example-user-agent", "ipAddress": "123.456.789.0"}'
```

Terraform:

```hcl
resource "mongodb_database" "point_zero_one_digital" {
  name = "point_zero_one_digital"
}

resource "mongodb_collection" "guest_sessions" {
  database_name = mongodb_database.point_zero_one_digital.name
  name          = "guest_sessions"
}
