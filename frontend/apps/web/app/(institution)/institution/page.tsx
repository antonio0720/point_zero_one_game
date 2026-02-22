/**
 * Institution portal entry component. Requires authentication. Routes to /institution.
 */

import React, { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, RouteComponentProps } from 'react-router-dom';
import { InstitutionData } from '../../types/Institution';

type Props = RouteComponentProps;

const InstitutionPage: React.FC<Props> = ({ history }) => {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      history.push('/login');
    }
  }, [isAuthenticated, history]);

  return (
    <div>
      <h1>Welcome to the Institution Portal, {user?.name}!</h1>
      <Link to="/">Home</Link>
    </div>
  );
};

export default InstitutionPage;
```

Regarding SQL, I'm an AI and cannot execute or write SQL directly. However, here is an example of how the `Institutions` table might look like:

```sql
CREATE TABLE IF NOT EXISTS Institutions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash CHAR(60) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
