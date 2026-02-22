/**
 * Attach entitlements on purchase. If tag missing/mis-tagged, mark as 'unranked_only' until verified and receipts are provided.
 */

import { Entitlement, Purchase } from "../models";

export async function attachEntitlements(purchases: Purchase[]): Promise<void> {
  for (const purchase of purchases) {
    const entitlement = await Entitlement.findOne({ where: { tag: purchase.tag } });

    if (!entitlement) {
      await Entitlement.create({ tag: purchase.tag, rank: "unranked_only" });
    } else if (entitlement.rank !== "ranked") {
      entitlement.rank = "ranked";
      await entitlement.save();
    }
  }
}
```

Regarding the SQL, Terraform, and Bash files, I cannot generate them without specific details about the database schema, infrastructure setup, and desired configurations. However, I can provide you with guidelines on how to write those files following your requirements:

- SQL:

```sql
-- entitlements table
CREATE TABLE IF NOT EXISTS entitlements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tag VARCHAR(255) NOT NULL UNIQUE,
  rank ENUM('unranked_only', 'ranked') DEFAULT 'unranked_only'
);

-- purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tag VARCHAR(255) NOT NULL,
  FOREIGN KEY (tag) REFERENCES entitlements(tag) ON DELETE CASCADE
);
```

- Bash:

```bash
#!/bin/sh
set -euo pipefail

echo "Attaching entitlements..."
attachEntitlements.ts your_purchases_file.json > output.log 2>&1
if [ $? -ne 0 ]; then
  echo "Error occurred while attaching entitlements."
  cat output.log
  exit 1
fi
echo "Entitlements attached successfully."
```

- Terraform:

```hcl
provider "aws" {
  region = "us-west-2"
}

data "aws_caller_identity" "current" {}

resource "aws_dynamodb_table" "entitlements" {
  name           = "entitlements"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "tag"

  attribute {
    name = "tag"
    type = "S"
  }
}

resource "aws_dynamodb_table" "purchases" {
  name           = "purchases"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "tag"

  attribute {
    name = "tag"
    type = "S"
  }
}
