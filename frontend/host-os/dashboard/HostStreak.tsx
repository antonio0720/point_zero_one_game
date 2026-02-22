/**
 * Streak counter component for Point Zero One Digital's financial roguelike game.
 * Displays consecutive weeks hosted, badge at 4/8/12/24 weeks, 'streak at risk' warning if no night logged in 8 days, share streak card.
 */

type StreakData = {
  currentStreak: number;
  maxStreak: number;
  isStreakAtRisk: boolean;
};

const HostStreak = ({ data }: { data: StreakData }) => {
  const { currentStreak, maxStreak, isStreakAtRisk } = data;

  return (
    <div className="host-streak">
      <h3>Streak</h3>
      <div className="badge">
        {currentStreak <= 3 ? (
          <span>{currentStreak}</span>
        ) : currentStreak <= 7 ? (
          <span>4+</span>
        ) : currentStreak <= 11 ? (
          <span>8+</span>
        ) : currentStreak <= 23 ? (
          <span>12+</span>
        ) : (
          <span>24+</span>
        )}
      </div>
      {isStreakAtRisk && <p className="warning">Streak at risk! Log in tonight to keep it going.</p>}
      <button className="share-streak">Share Streak</button>
    </div>
  );
};

export default HostStreak;
```

Regarding the SQL, I'll provide an example of a table schema for tracking user streaks:

```sql
CREATE TABLE IF NOT EXISTS user_streak (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  currentStreak INT NOT NULL DEFAULT 0,
  maxStreak INT NOT NULL DEFAULT 0,
  lastLoggedIn DATETIME NOT NULL,
  UNIQUE INDEX user_streak_userId (userId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
