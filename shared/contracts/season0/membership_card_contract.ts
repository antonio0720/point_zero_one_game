/**
 * Membership Card View Model
 */
export interface MembershipCard {
  id: number;
  ownerId: number;
  cardTypeId: number;
  expirationDate: Date;
  isActive: boolean;
}

/**
 * Proof Gallery Summary Model
 */
export interface ProofGallerySummary {
  id: number;
  membershipCardId: number;
  proofCount: number;
}
```

```sql
-- Membership Card Table
CREATE TABLE IF NOT EXISTS membership_cards (
  id INT PRIMARY KEY,
  owner_id INT NOT NULL,
  card_type_id INT NOT NULL,
  expiration_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (card_type_id) REFERENCES card_types(id)
);

-- Proof Gallery Summary Table
CREATE TABLE IF NOT EXISTS proof_gallery_summaries (
  id INT PRIMARY KEY,
  membership_card_id INT NOT NULL,
  proof_count INT NOT NULL,
  FOREIGN KEY (membership_card_id) REFERENCES membership_cards(id)
);
```

```bash
#!/bin/bash
set -euo pipefail
echo "Creating tables"
sqlite3 db.sqlite < create_tables.sql
echo "Tables created successfully."

# Example of creating create_tables.sql file
cat > create_tables.sql << EOF
-- Membership Card Table
CREATE TABLE IF NOT EXISTS membership_cards (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  card_type_id INTEGER NOT NULL,
  expiration_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (card_type_id) REFERENCES card_types(id)
);

-- Proof Gallery Summary Table
CREATE TABLE IF NOT EXISTS proof_gallery_summaries (
  id INTEGER PRIMARY KEY,
  membership_card_id INTEGER NOT NULL,
  proof_count INTEGER NOT NULL,
  FOREIGN KEY (membership_card_id) REFERENCES membership_cards(id)
);
EOF
```

```yaml
apiVersion: v1
kind: Game
metadata:
  name: point-zero-one-digital
spec:
  gameType: roguelike
  durationMinutes: 12
  infrastructure:
    type: sovereign
  contracts:
    - name: membership_card_contract
      version: season0
      files:
        - shared/contracts/season0/membership_card_contract.ts
