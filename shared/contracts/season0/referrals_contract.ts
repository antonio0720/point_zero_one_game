/**
 * Referrals Contract for Season 0
 */

type ReferralCode = string;

interface Invite {
    referrer: string;
    invitee: string;
    createdAt: Date;
}

interface Acceptance {
    inviteId: string;
    acceptor: string;
    acceptedAt: Date;
}

interface Completion {
    acceptanceId: string;
    completedAt: Date;
}

type Limit = {
    maxReferralsPerUser: number;
    maxActiveReferrals: number;
}

type RewardUnlockEvent = {
    rewardId: string;
    unlockedAt: Date;
}

/**
 * Referral limits for a user in Season 0.
 */
const limits: Limit = {
    maxReferralsPerUser: 10,
    maxActiveReferrals: 5,
};

export { ReferralCode, Invite, Acceptance, Completion, limits, RewardUnlockEvent };
```

SQL (PostgreSQL):

```sql
-- Schema for Season 0 Referrals Contract

CREATE SCHEMA IF NOT EXISTS season0;

CREATE TABLE IF NOT EXISTS season0.referral_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS season0.invites (
    id SERIAL PRIMARY KEY,
    referrer_id INT REFERENCES users(id),
    invitee_id INT REFERENCES users(id),
    code_id INT REFERENCES season0.referral_codes(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (referrer_id, code_id)
);

CREATE TABLE IF NOT EXISTS season0.acceptances (
    id SERIAL PRIMARY KEY,
    invite_id INT REFERENCES season0.invites(id),
    acceptor_id INT REFERENCES users(id),
    accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invite_id) REFERENCES season0.invites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS season0.completions (
    id SERIAL PRIMARY KEY,
    acceptance_id INT REFERENCES season0.acceptances(id),
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (acceptance_id) REFERENCES season0.acceptances(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS season0.reward_unlock_events (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    reward_id INT REFERENCES rewards(id),
    unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, reward_id)
);
```

Bash:

```bash
#!/bin/bash
set -euo pipefail
echo "Creating referral codes table"
psql -q -f create_referral_codes.sql
echo "Creating invites table"
psql -q -f create_invites.sql
echo "Creating acceptances table"
psql -q -f create_acceptances.sql
echo "Creating completions table"
psql -q -f create_completions.sql
echo "Creating reward unlock events table"
psql -q -f create_reward_unlock_events.sql
