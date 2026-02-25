/**
 * OnboardingArc service for Point Zero One Digital's financial roguelike game.
 * This service handles stage assignment, episode selection, and constraints.
 */

declare module '*.json';
import { Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Database connection
const pool = new Pool({
  user: 'your_database_user',
  host: 'your_database_host',
  database: 'your_database_name',
  password: 'your_database_password',
  port: your_database_port,
});

/**
 * Interface for GameData representing game state data.
 */
interface GameData {
  playerId: string;
  currentStage: number;
  currentEpisode: number;
}

/**
 * Function to assign a new stage and episode to a player.
 * @param req Express request object containing playerId.
 * @param res Express response object to send the assigned stage and episode.
 */
export const assignStageAndEpisode = async (req: Request, res: Response) => {
  // Get playerId from request
  const playerId = req.params.playerId;

  // Check if player exists in database
  const result = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Get next available stage and episode
  const result2 = await pool.query('SELECT current_stage + 1 AS newStage, COUNT(*) AS episodeCount FROM onboarding_arcs WHERE stage <= (SELECT max(current_stage) FROM onboarding_arcs) GROUP BY current_stage ORDER BY episodeCount DESC LIMIT 1');
  const { newStage, episodeCount } = result2.rows[0];

  // Update player's game data in database
  await pool.query('UPDATE players SET currentStage = $1 WHERE id = $2', [newStage, playerId]);
  await pool.query('INSERT INTO game_data (playerId, currentStage, currentEpisode) VALUES ($1, $2, 1)', [playerId, newStage]);

  // Send response with assigned stage and episode
  res.json({ stage: newStage, episode: 1, episodeCount });
};

/**
 * Function to check if a player can proceed to the next episode.
 * @param req Express request object containing playerId and currentEpisode.
 * @param res Express response object to send the result of the check.
 */
export const canProceedToNextEpisode = async (req: Request, res: Response) => {
  // Get playerId and currentEpisode from request
  const playerId = req.params.playerId;
  const currentEpisode = parseInt(req.params.currentEpisode);

  // Check if player exists in database
  const result = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Check if player has completed the current episode
  const result2 = await pool.query('SELECT COUNT(*) FROM game_data WHERE playerId = $1 AND currentEpisode = $2', [playerId, currentEpisode]);
  const episodeCompleted = result2.rows[0].count > 0;

  // If player has completed the current episode, proceed to next one
  if (episodeCompleted) {
    const result3 = await pool.query('SELECT current_episode + 1 AS newEpisode FROM onboarding_arcs WHERE stage = (SELECT currentStage FROM players WHERE id = $1)', [playerId]);
    const newEpisode = result3.rows[0].newEpisode;

    // Update player's game data in database
    await pool.query('UPDATE game_data SET currentEpisode = $1 WHERE playerId = $2', [newEpisode, playerId]);
  }

  // Send response with the result of the check
  res.json({ canProceed: episodeCompleted });
};
```

Please replace `your_database_*` with your actual database credentials and adjust the SQL queries as needed for your specific database schema.

Regarding the SQL, here's an example of how you might create the tables in PostgreSQL:

```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currentStage INTEGER NOT NULL,
  currentEpisode INTEGER NOT NULL
);

CREATE TABLE onboarding_arcs (
  stage INTEGER PRIMARY KEY,
  episode INTEGER NOT NULL,
  UNIQUE (stage, episode)
);

CREATE TABLE game_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playerId UUID NOT NULL REFERENCES players(id),
  currentStage INTEGER NOT NULL,
  currentEpisode INTEGER NOT NULL,
  FOREIGN KEY (playerId, currentStage) REFERENCES players(id, currentStage)
);
