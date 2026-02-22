import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Run } from '../interfaces/run.interface';
import runsService from '../services/runs.service';

const router = express.Router();

router.post('/', async (req, res) => {
try {
const run: Run = req.body;
run.id = uuidv4();

await runsService.createRun(run);

res.status(201).json({ message: 'Run created successfully', run });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while creating the run' });
}
});

export default router;
