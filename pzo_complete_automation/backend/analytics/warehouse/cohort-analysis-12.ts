import express from 'express';
import { Pool } from 'pg';

const app = express();
const pool = new Pool({
user: 'dbuser',
host: 'database',
database: 'analytics',
password: 'dbpassword',
port: 5432,
});

app.get('/cohort-analysis/:startDate/:endDate', async (req, res) => {
const startDate = req.params.startDate;
const endDate = req.params.endDate;

try {
const client = await pool.connect();

const result = await client.query(
'SELECT DATE_TRUNC(\'month\', created_at) AS month, COUNT(*) as users FROM users WHERE created_at BETWEEN $1 AND $2 GROUP BY month ORDER BY month',
[startDate, endDate]
);

const cohortData = result.rows.map((row) => ({
month: row.month,
users: row.users,
}));

res.json(cohortData);
} catch (err) {
console.error(err);
res.status(500).send('Server error');
}
});

app.listen(3000, () => console.log('App running on port 3000'));
