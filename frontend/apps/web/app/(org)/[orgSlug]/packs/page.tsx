/**
 * Outcome Packs page (assign packs to cohorts, view pack contents)
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pack, Cohort, Assignment } from '../../types';

type Props = {};

const Page: React.FC<Props> = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const [packs, setPacks] = useState<Pack[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Fetch data from API or local storage
  // ...

  return (
    <div>
      {/* Render packs list */}
      {packs.map((pack) => (
        <div key={pack.id}>
          {/* Render pack details */}
          {/* Assign pack to cohorts form */}
        </div>
      ))}

      {/* Render cohorts list */}
      {cohorts.map((cohort) => (
        <div key={cohort.id}>
          {/* Render cohort details */}
          {/* View pack assignments for this cohort */}
        </div>
      ))}
    </div>
  );
};

export default Page;
```

Regarding the SQL, YAML/JSON, and Terraform files, I cannot generate them without specific table structures, data samples, and deployment configurations. However, I can provide you with an example of how to write idempotent CREATE statements for a PostgreSQL database:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create packs table
CREATE TABLE IF NOT EXISTS packs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cohort_id INTEGER REFERENCES cohorts(id)
);

-- Create cohorts table
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

For Bash scripts, I cannot generate a specific example without knowing the exact actions that need to be performed. However, here's an example of how to set up the environment variables and run a command with proper error handling:

```bash
#!/bin/sh
set -euo pipefail

export MY_VAR=value
command_to_run
