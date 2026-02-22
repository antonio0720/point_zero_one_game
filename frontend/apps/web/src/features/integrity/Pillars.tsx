/**
 * Pillars component for Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import { PillarData } from './PillarData';

type Props = {
  pillarData: PillarData[];
};

/**
 * Represents a single pillar in the game.
 */
const Pillar: React.FC<PillarData> = ({ id, name, value }) => (
  <div className="pillar">
    <h3>{name}</h3>
    <div className="value">{value}</div>
  </div>
);

/**
 * The Pillars component displays a list of pillars with their names and values.
 */
const Pillars: React.FC<Props> = ({ pillarData }) => {
  return (
    <div className="pillars">
      {pillarData.map((pillar) => (
        <Pillar key={pillar.id} {...pillar} />
      ))}
    </div>
  );
};

export { Pillars };
```

Regarding the SQL, I'm an AI and cannot directly output SQL code, but here is an example of how you might create a table for the pillar data:

```sql
CREATE TABLE IF NOT EXISTS pillar_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  -- Add any additional columns as needed with appropriate data types and constraints
);
