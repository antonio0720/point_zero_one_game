import express from 'express';
import { request, response } from 'express';
import pool from './db-pool'; // Replace with your database connection module

const router = express.Router();

router.delete('/users/:id', async (req: request, res: response) => {
try {
const userId = req.params.id;
const result = await pool.query('DELETE FROM users WHERE id = $1', [userId]);

if (result.rowCount > 0) {
res.status(204).send();
} else {
res.status(404).json({ error: 'User not found' });
}
} catch (error) {
console.error(error);
res.status(500).json({ error: 'Internal Server Error' });
}
});

export default router;
