/**
 * LadderRewardsPanel component for displaying earned rewards and next unlock in Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Reward = {
  /** Unique identifier for the reward */
  id: number;
  /** Amount of currency earned upon unlocking this reward */
  amount: number;
};

interface LadderRewardsPanelProps {
  /** Array of rewards earned by the player */
  rewards: Reward[];
  /** Index of the next unlockable reward */
  nextUnlockIndex: number;
}

const LadderRewardsPanel: React.FC<LadderRewardsPanelProps> = ({ rewards, nextUnlockIndex }) => {
  return (
    <div>
      {rewards.map((reward, index) => (
        <div key={reward.id}>
          {index === nextUnlockIndex ? (
            <strong>Next unlock: {reward.amount} currency</strong>
          ) : (
            <span>{reward.amount} currency earned</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default LadderRewardsPanel;
```

Regarding the SQL, it's important to note that I am an AI and cannot execute or create database operations. However, here is an example of how you might structure a `rewards` table for this application:

```sql
CREATE TABLE IF NOT EXISTS rewards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  amount DECIMAL(10,2) NOT NULL,
  UNIQUE INDEX unique_reward (id)
);
