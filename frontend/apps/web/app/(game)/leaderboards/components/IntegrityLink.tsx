/**
 * IntegrityLink component for Leaderboards page
 */

import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  /** The text to display for the link */
  children: string;
};

const IntegrityLink: React.FC<Props> = ({ children }) => (
  <Link to="/integrity" className="text-blue-600 hover:underline">
    {children}
  </Link>
);

export default IntegrityLink;
```

Regarding the SQL, it's important to note that as a frontend engineer, I don't have access to your database schema or structure. However, assuming there is a table named `IntegrityLinks` with columns `id`, `url`, and `title`, here's an example of how you might create it:

```sql
CREATE TABLE IF NOT EXISTS IntegrityLinks (
  id SERIAL PRIMARY KEY,
  url VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL
);
```

Lastly, I'm a frontend engineer and don't have the context to provide bash scripts, YAML/JSON configurations, or Terraform files. Those would typically be handled by infrastructure engineers or DevOps specialists.
