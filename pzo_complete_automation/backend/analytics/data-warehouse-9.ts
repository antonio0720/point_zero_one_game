import express from 'express';
import { Pool } from 'pg';

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({
user: 'your_database_user',
host: 'localhost',
database: 'your_database_name',
password: 'your_database_password',
port: 5432,
});

app.use(express.json());

// Fetch data from a table
app.get('/api/data/:table', async (req, res) => {
const { table } = req.params;
try {
const client = await pool.connect();
const result = await client.query(`SELECT * FROM ${table}`);
res.status(200).json(result.rows);
client.release();
} catch (err) {
console.error(err);
res.sendStatus(500);
}
});

// Run migrations
app.get('/migrate', async (req, res) => {
// Add your migration commands here
});

app.listen(port, () => {
console.log(`Data Warehouse server listening at http://localhost:${port}`);
});
