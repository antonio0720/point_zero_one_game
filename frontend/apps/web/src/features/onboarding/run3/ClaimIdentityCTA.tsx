/**
 * ClaimIdentityCTA component for post-run conversion CTA.
 * Claim identity to save, stamp, rank and share.
 */

import React from 'react';
import { Button } from '@pointzeroonedigital/ui-kit';

type Props = {
  /** Callback function when the claim identity button is clicked */
  onClaimIdentity: () => void;
};

const ClaimIdentityCTA: React.FC<Props> = ({ onClaimIdentity }) => (
  <Button onClick={onClaimIdentity}>Claim Identity</Button>
);

export default ClaimIdentityCTA;
```

Regarding the SQL, as it's not specified in the prompt, I won't provide any SQL code. However, if you need help with that, please let me know and I can create a separate response for it.

For the sake of completeness, here is an example of how the SQL might look like:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
