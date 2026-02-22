import * as express from 'express';
import * as bodyParser from 'body-parser';
import { Pool } from 'pg';

const app = express();
app.use(bodyParser.json());

// Database connection configuration
const pool = new Pool({
user: 'your_user',
host: 'localhost',
database: 'your_database',
password: 'your_password',
port: 5432,
});

pool.on('error', (err) => {
console.log('Unexpected error on idle client', err);
process.exit(-1);
});

app.get('/data/sales', async (req, res) => {
try {
const result = await pool.query('SELECT * FROM sales');
res.json(result.rows);
} catch (err) {
console.error(err);
res.sendStatus(500);
}
});

app.listen(3000, () => {
console.log('Server is running on port 3000');
});
