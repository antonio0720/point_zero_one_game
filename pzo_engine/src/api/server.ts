import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

interface Run {
  id: string;
  audit_hash: string;
}

interface LeaderboardEntry {
  id: string;
  score: number;
}

const runs: Run[] = [];
let ml_enabled = true;

app.post('/runs', (req: Request, res: Response) => {
  const run_id = uuidv4();
  const run: Run = { id: run_id, audit_hash: '...' };
  runs.push(run);
  if (ml_enabled) {
    // Call ML model here
  }
  res.json({ id: run_id });
});

app.get('/leaderboard', (req: Request, res: Response) => {
  const leaderboard: LeaderboardEntry[] = runs.map((run) => ({
    id: run.id,
    score: Math.random(), // Replace with actual scoring logic
  }));
  res.json(leaderboard);
});

app.get('/runs/:id/replay', (req: Request, res: Response) => {
  const run_id = req.params.id;
  const run = runs.find((run) => run.id === run_id);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  // Return replay data here
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
