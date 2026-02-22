import express from 'express';
import { Pool } from 'pg';
import { QueryResultsRow } from 'pg-query-stream';

const app = express();
const pool = new Pool({
user: 'your_user',
host: 'localhost',
database: 'your_database',
password: 'your_password',
port: 5432,
});

app.get('/cohort-analysis-7', async (req, res) => {
const startDate = new Date(new Date().setDate(new Date().getDate() - 84)); // 12 weeks ago
const endDate = new Date();

pool.query(`
SELECT
DATE_TRUNC('week', created_at) AS week,
COUNT(*) AS users,
COUNT(CASE WHEN subscription_date IS NOT NULL THEN id END) AS subscribed
FROM users
WHERE created_at BETWEEN $1 AND $2
GROUP BY 1
ORDER BY week;
`, [startDate, endDate], (err, result) => {
if (err) throw err;
res.json(result.rows);
});
});

app.listen(3000, () => console.log('Server started on port 3000'));
