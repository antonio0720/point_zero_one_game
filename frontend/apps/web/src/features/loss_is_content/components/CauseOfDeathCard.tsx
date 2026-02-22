/**
 * CauseOfDeathCard component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Props = {
  causeOfDeath: string;
  delta: number;
  survivalHint?: string;
  onShareClick?: () => void;
};

const CauseOfDeathCard: React.FC<Props> = ({
  causeOfDeath,
  delta,
  survivalHint,
  onShareClick,
}) => {
  return (
    <div className="cause-of-death-card">
      <h2>{causeOfDeath}</h2>
      <div className="delta-strip">
        <span className={`delta delta-${delta > 0 ? 'positive' : 'negative'}`}>{delta}</span>
      </div>
      {survivalHint && <p className="survival-hint">{survivalHint}</p>}
      <button onClick={onShareClick} className="share-button">Share</button>
    </div>
  );
};

export { CauseOfDeathCard };
```

Regarding the SQL, it's important to note that I am an AI and cannot execute or create actual database schema. However, here is an example of how you might define a table for this component in SQL:

```sql
CREATE TABLE IF NOT EXISTS cause_of_death_cards (
  id SERIAL PRIMARY KEY,
  cause_of_death VARCHAR(255) NOT NULL,
  delta INTEGER NOT NULL,
  survival_hint TEXT,
  FOREIGN KEY (id) REFERENCES games(id) ON DELETE CASCADE
);
