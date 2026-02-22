import sqlite3 from 'sqlite3';
import express from 'express';
const app = express();
const db = new sqlite3.Database('./database.db');

app.use(express.json());

// Define data retention policy (e.g., keep data for 1 year)
const dataRetentionDays = 365;

function getCurrentTimestamp() {
const date = new Date();
return Math.floor(date.getTime() / 1000);
}

app.delete('/users/:id', (req, res) => {
const userId = req.params.id;
db.get(`SELECT created_at FROM users WHERE id=?`, [userId], (err, row) => {
if (err) return res.status(500).send({ error: err });
if (!row) return res.status(404).send({ error: 'User not found' });

const age = getCurrentTimestamp() - row.created_at;
if (age > dataRetentionDays * 86400) { // Ensure the user is eligible for deletion
db.run(`DELETE FROM users WHERE id=?`, [userId], (err, result) => {
if (err) return res.status(500).send({ error: err });
res.sendStatus(204); // No content response
});
} else {
res.status(403).send({ error: 'Data retention policy violation' });
}
});
});

app.listen(3000, () => console.log('Server started on port 3000'));
