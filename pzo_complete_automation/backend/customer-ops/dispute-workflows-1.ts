import express from 'express';
import disputeRouter from './customer-ops/dispute-workflows-1';

const app = express();
app.use('/api', disputeRouter);
app.listen(3000, () => console.log('Server listening on port 3000'));
