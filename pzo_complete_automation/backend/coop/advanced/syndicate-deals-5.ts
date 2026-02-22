import express from 'express';
import { Pool } from 'pg';

const pool = new Pool({
user: 'dbuser',
host: 'database.server.com',
database: 'mydb',
password: 'secretpassword',
port: 5432,
});

const app = express();
app.use(express.json());

interface SyndicateDeal {
id: number;
property_id: number;
deal_amount: number;
investor_id: number;
}

app.get('/api/syndicate-deals', async (req, res) => {
try {
const result = await pool.query('SELECT * FROM syndicate_deals');
res.json(result.rows);
} catch (err) {
console.error(err);
res.status(500).send('Server error');
}
});

app.post('/api/syndicate-deals', async (req, res) => {
const { property_id, deal_amount, investor_id } = req.body;

try {
await pool.query(
'INSERT INTO syndicate_deals (property_id, deal_amount, investor_id) VALUES ($1, $2, $3)',
[property_id, deal_amount, investor_id]
);
res.status(201).send('Deal created');
} catch (err) {
console.error(err);
res.status(500).send('Server error');
}
});

app.listen(3000, () => {
console.log('Server started on port 3000');
});
