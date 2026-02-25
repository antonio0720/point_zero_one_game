Here is the TypeScript implementation for the specified endpoints:

```typescript
// backend/src/services/run_explorer_api/run_explorer_api_impl.ts

import express from 'express';
import { Request, Response } from 'express';
import { RunExplorer, RunExplorerDocument } from '../models/RunExplorer';
import { Turn } from '../models/Turn';
import { VerificationPanel } from '../models/VerificationPanel';
import db from '../database';

const router = express.Router();

// GetRunExplorerByRunId
router.get('/run/:id', async (req: Request, res: Response) => {
  const runId = req.params.id;
  const runExplorer = await RunExplorer.findOne({ runId })
    .populate('turns')
    .exec();
  res.json(runExplorer);
});

// GetRunExplorerByProofHash
router.get('/proof/:hash', async (req: Request, res: Response) => {
  const proofHash = req.params.hash;
  const runExplorer = await RunExplorer.findOne({ proofHash })
    .populate('turns')
    .exec();
  res.json(runExplorer);
});

// GetReplayWindow (from_turn, to_turn)
router.get('/replay/:fromTurn/:toTurn', async (req: Request, res: Response) => {
  const fromTurn = parseInt(req.params.fromTurn);
  const toTurn = parseInt(req.params.toTurn);
  const replayWindow = await Turn.find({ turnId: { $gte: fromTurn, $lte: toTurn } })
    .populate('runExplorer')
    .exec();
  res.json(replayWindow);
});

// GetVerificationPanel
router.get('/verification', async (req: Request, res: Response) => {
  const verificationPanel = await VerificationPanel.findOne()
    .exec();
  res.json(verificationPanel);
});

export default router;
```

Please note that this is a TypeScript implementation for the specified endpoints and assumes the existence of models `RunExplorer`, `Turn`, and `VerificationPanel`. The models should be defined elsewhere in your project, and they should have strict types with no 'any'.

Also, I've assumed that you are using Mongoose as the ORM for MongoDB. If that is not the case, please adjust the code accordingly.
