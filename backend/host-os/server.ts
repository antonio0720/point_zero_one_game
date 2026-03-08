// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/server.ts

/**
 * Point Zero One — Host OS Service
 * Standalone Express service for host kit delivery, email tracking,
 * nurture dispatch, and Host OS operational flows.
 */

import express, { type Express, type Request, type Response } from 'express';
import kitDownloadRouter from './routes/kit-download';
import emailTrackingRouter from './routes/email-tracking';
import emailDispatchRouter from './routes/email-dispatch';
import { closeDb, pingDb } from './db/connection';
import {
  ensureHostRegistrationSchema,
} from './db/host-registrations';
import {
  ensureHostEmailSchema,
} from './db/host-email-events';

const DEFAULT_PORT = 4317;

export async function createHostOsApp(): Promise<Express> {
  await ensureHostRegistrationSchema();
  await ensureHostEmailSchema();

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/healthz', async (_req: Request, res: Response) => {
    const dbOk = await pingDb();
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      service: 'pzo-host-os',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/host/download', kitDownloadRouter);
  app.use('/host/email', emailTrackingRouter);
  app.use('/host/internal/email', emailDispatchRouter);

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use(
    (
      error: Error,
      _req: Request,
      res: Response,
      _next: (error?: unknown) => void,
    ) => {
      console.error('[host-os] unhandled error', error);
      res.status(500).json({
        ok: false,
        error: 'Internal server error',
      });
    },
  );

  return app;
}

async function start(): Promise<void> {
  const app = await createHostOsApp();
  const port = Number(process.env.HOST_OS_PORT || process.env.PORT || DEFAULT_PORT);

  const server = app.listen(port, () => {
    console.log(`[host-os] listening on :${port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[host-os] received ${signal}, shutting down`);
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (require.main === module) {
  void start();
}