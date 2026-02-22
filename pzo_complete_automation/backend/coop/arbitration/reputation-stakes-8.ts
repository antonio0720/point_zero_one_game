import express from 'express';
import { Pool } from 'pg';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

// Database connection settings
const pool = new Pool({
user: 'your_db_user',
host: 'localhost',
database: 'your_db_name',
password: 'your_db_password',
port: 5432,
});

app.post('/reputation-stakes-8', async (req, res) => {
const { playerId, coopGameId, contribution } = req.body;

// Query to update the player's reputation points
await pool.query(
'UPDATE players SET reputation_points = reputation_points + $1 WHERE id = $2',
[contribution, playerId]
);

// Query to update coop game's total contribution
const result = await pool.query(
'SELECT total_contributions FROM coop_games WHERE id = $1',
[coopGameId]
);

const currentTotalContribution = parseInt(result.rows[0].total_contributions || '0');
await pool.query('UPDATE coop_games SET total_contributions = $1 WHERE id = $2', [currentTotalContribution + contribution, coopGameId]);

res.status(200).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
