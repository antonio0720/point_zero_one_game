/**
 * Admin service for Season0 management.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Membership entity. */
export class Membership {
  id: number;
  userId: number;
  seasonId: number;
  createdAt: Date;
}

/** Receipt entity. */
export class Receipt {
  id: number;
  membershipId: number;
  amount: number;
  currency: string;
  createdAt: Date;
}

/** ReferralThrottle entity. */
export class ReferralThrottle {
  id: number;
  userId: number;
  seasonId: number;
  remainingReferrals: number;
  createdAt: Date;
}

/** StampIssuanceHealth entity. */
export class StampIssuanceHealth {
  id: number;
  seasonId: number;
  totalStampsIssued: number;
  totalStampsAvailable: number;
  createdAt: Date;
}

/** AdminService interface. */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReferralThrottle)
    private readonly referralThrottleRepository: Repository<ReferralThrottle>,
    @InjectRepository(StampIssuanceHealth)
    private readonly stampIssuanceHealthRepository: Repository<StampIssuanceHealth>,
  ) {}

  // Admin service methods go here...
}
```

SQL (PostgreSQL):

```sql
-- Membership table
CREATE TABLE IF NOT EXISTS memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (user_id, season_id)
);

-- Receipt table
CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    membership_id INTEGER NOT NULL REFERENCES memberships(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
);

-- ReferralThrottle table
CREATE TABLE IF NOT EXISTS referral_throttles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    remaining_referrals INTEGER NOT NULL DEFAULT 5, -- Default value for new users
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (user_id, season_id)
);

-- StampIssuanceHealth table
CREATE TABLE IF NOT EXISTS stamp_issuance_health (
    id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL,
    total_stamps_issued INTEGER NOT NULL DEFAULT 0,
    total_stamps_available INTEGER NOT NULL DEFAULT 100, -- Default value for new seasons
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
);
```

Bash (example):

```bash
#!/bin/sh
set -euo pipefail
echo "Starting script..."
# Script actions go here...
echo "Script completed."
```

Terraform (example):

```hcl
resource "aws_rds_instance" "point_zero_one_digital_db" {
  allocated_storage      = 20
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "13.4"
  instance_class         = "db.t2.micro"
  username               = "adminuser"
  password               = "supersecretpassword"
  db_name                = "point_zero_one_digital"
  skip_final_snapshot    = true
  vpc_security_group_ids  = [aws_security_group.point_zero_one_digital.id]
}
