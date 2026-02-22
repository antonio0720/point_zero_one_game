// pzo_server/src/index.ts

import * as express from 'express';
import { Server } from 'socket.io';

const app = express();
app.use(express.json());

const mlEnabled = process.env.ML_ENABLED === 'true';
if (mlEnabled) {
  const model = require('./models/ml_model');
}

let auditHash: string | null = null;

function generateAuditHash(): void {
  if (!auditHash) {
    auditHash = crypto.createHash('sha256').update(Math.random().toString()).digest('hex');
  }
}

const io = new Server(app.listen(3000, () => console.log('Server listening on port 3000')));

io.on('connection', (socket: any) => {
  generateAuditHash();

  socket.emit('audit_hash', auditHash);

  if (mlEnabled) {
    const output = model.predict(socket.handshake.query.data);
    socket.emit('output', Math.min(Math.max(output, 0), 1));
  }
});

export { app };
