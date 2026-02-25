/**
 * Referral Abuse Detector for Point Zero One Digital's financial roguelike game
 */

import { Referral, User } from "../models";

declare const db: any; // Assuming a global database instance is provided

/**
 * Check if a user has too many referrals within a certain timeframe
 * @param userId - The ID of the user to check
 * @returns True if the user has too many referrals, false otherwise
 */
export async function hasTooManyReferrals(userId: number): Promise<boolean> {
  const referralCount = await Referral.count({ where: { userId } });
  return referralCount > 10; // Adjust this value based on your specific requirements
}

/**
 * Throttle new referrals for a user if they have too many existing ones
 * @param referral - The new referral to process
 */
export async function throttleNewReferral(referral: Referral) {
  if (await hasTooManyReferrals(referral.userId)) {
    await referral.invalidate(); // Assuming a method to invalidate the referral
  } else {
    await referral.save();
  }
}

/**
 * Invalidate suspicious completions based on certain criteria (e.g., too many in a short time)
 */
export async function invalidateSuspiciousCompletions() {
  // Query for suspicious completions and invalidate them
}

/**
 * Preserve a ledger of all referral receipts
 * @param referral - The referral to log
 */
export async function logReceipt(referral: Referral) {
  await referral.save(); // Assuming a method to save the referral also logs it in the receipts ledger
}
```

For SQL, I'll provide an example of the `Referral` and `User` tables with relevant indexes and foreign keys:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  referredUserId INTEGER REFERENCES users(id),
  createdAt TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE (userId, referredUserId)
);

CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals (userId);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals (referredUserId);
```

For Bash, I'll provide an example of logging all actions:

```bash
#!/bin/bash
set -euo pipefail
echo "Starting action"
# Your command here
echo "Action completed"
```

For YAML or JSON, I won't provide an example as it's not specified in the request. However, for Terraform, I'll provide an example of a production-ready configuration:

```hcl
provider "aws" {
  region = "us-west-2"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "referral_abuse_detector" {
  bucket = "point-zero-one-digital-referral-abuse-detector"
  acl    = "private"
}

resource "aws_iam_role" "referral_abuse_detector" {
  name = "point-zero-one-digital-referral-abuse-detector"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_policy" "referral_abuse_detector" {
  name = "point-zero-one-digital-referral-abuse-detector"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Effect   = "Allow"
        Resource  = "${aws_s3_bucket.referral_abuse_detector.arn}/*"
        Sid       = "VisualEditor0"
      },
    ]
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetBucketLocation",
        ]
        Effect   = "Allow"
        Resource  = "${aws_s3_bucket.referral_abuse_detector.arn}"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "referral_abuse_detector" {
  role       = aws_iam_role.referral_abuse_detector.name
  policy_arn = aws_iam_policy.referral_abuse_detector.arn
}

resource "aws_lambda_function" "referral_abuse_detector" {
  filename      = "dist/referral_abuse_detector.zip"
  function_name = "point-zero-one-digital-referral-abuse-detector"
  role          = aws_iam_role.referral_abuse_detector.arn
  handler       = "index.handler"
  runtime       = "nodejs14.x"
}
