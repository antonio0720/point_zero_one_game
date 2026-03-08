// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/__tests__/kit-download.test.ts

import express, { type Router } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

type DbModuleShape = {
  oneOrNone: ReturnType<typeof vi.fn>;
  none: ReturnType<typeof vi.fn>;
};

type WebhookFn = ReturnType<typeof vi.fn>;
type PutObjectSpy = ReturnType<typeof vi.fn>;
type GetSignedUrlSpy = ReturnType<typeof vi.fn>;

function createApp(router: Router) {
  const app = express();
  app.use(express.json());
  app.use('/download', router);
  return app;
}

async function startServer(router: Router): Promise<Server> {
  const app = createApp(router);

  return await new Promise<Server>((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function stopServer(server: Server | null): Promise<void> {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function getBaseUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Test server address is unavailable.');
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function postJson(
  server: Server,
  path: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return await fetch(`${getBaseUrl(server)}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

describe('Kit Download route', () => {
  let server: Server | null = null;
  let limiterHits: Map<string, number>;
  let webhook: WebhookFn;
  let db: DbModuleShape;
  let putObjectSpy: PutObjectSpy;
  let getSignedUrlSpy: GetSignedUrlSpy;
  let currentUser:
    | {
        id: number;
        email: string;
      }
    | null;
  let originalS3Bucket: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    originalS3Bucket = process.env.S3_BUCKET;
    process.env.S3_BUCKET = 'unit-test-host-os-bucket';

    limiterHits = new Map<string, number>();
    currentUser = {
      id: 42,
      email: 'valid@email.com',
    };

    webhook = vi.fn(async () => undefined);

    db = {
      oneOrNone: vi.fn(async (_query: string, params: unknown[]) => {
        const email = String(params[0] ?? '');
        if (currentUser && email === currentUser.email) {
          return currentUser;
        }
        return null;
      }),
      none: vi.fn(async () => undefined),
    };

    putObjectSpy = vi.fn(async () => undefined);
    getSignedUrlSpy = vi.fn(() => 'https://cdn.example.com/kits/kit-uuid-123.zip?sig=test');

    vi.doMock('../db', () => ({
      default: db,
    }));

    vi.doMock('../webhooks/host_kit_downloaded', () => ({
      default: webhook,
    }));

    vi.doMock('uuid', () => ({
      v4: () => 'kit-uuid-123',
    }));

    vi.doMock('rate-limiter-flexible', () => ({
      RateLimiterRedis: class FakeRateLimiterRedis {
        constructor(_options?: unknown) {}

        async consume(key: string) {
          const current = limiterHits.get(key) ?? 0;

          if (current >= 3) {
            const error = new Error('Rate limit exceeded');
            (error as Error & { msBeforeNext?: number }).msBeforeNext = 86_400_000;
            throw error;
          }

          limiterHits.set(key, current + 1);

          return {
            remainingPoints: Math.max(0, 3 - (current + 1)),
          };
        }
      },
    }));

    vi.doMock('aws-sdk', () => ({
      default: {
        S3: class FakeS3 {
          putObject(params: unknown) {
            return {
              // cast the mock to any so TypeScript treats it as callable
              promise: () => (putObjectSpy as any)(params),
            };
          }

          getSignedUrl(...args: unknown[]) {
            // cast the mock to any so TypeScript treats it as callable
            return (getSignedUrlSpy as any)(...args);
          }
        },
      },
    }));

    const { default: router } = await import('../routes/kit-download');
    server = await startServer(router);
  });

  afterEach(async () => {
    await stopServer(server);
    server = null;

    if (originalS3Bucket === undefined) {
      delete process.env.S3_BUCKET;
    } else {
      process.env.S3_BUCKET = originalS3Bucket;
    }

    vi.restoreAllMocks();
  });

  it('returns a signed zip URL and triggers persistence + webhook for a valid email', async () => {
    if (!server) {
      throw new Error('Server was not initialized.');
    }

    const response = await postJson(server, '/download', {
      email: 'valid@email.com',
    });

    const body = (await response.json()) as { url?: string };

    expect(response.status).toBe(200);
    expect(body.url).toContain('https://cdn.example.com/kits/kit-uuid-123.zip');
    expect(db.oneOrNone).toHaveBeenCalledTimes(1);
    expect(db.none).toHaveBeenCalledTimes(1);
    expect(webhook).toHaveBeenCalledTimes(1);
    expect(webhook).toHaveBeenCalledWith(42);
    expect(putObjectSpy).toHaveBeenCalledTimes(1);
    expect(getSignedUrlSpy).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for an invalid email payload', async () => {
    if (!server) {
      throw new Error('Server was not initialized.');
    }

    const response = await postJson(server, '/download', {
      email: 'invalidemail',
    });

    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(db.oneOrNone).not.toHaveBeenCalled();
    expect(db.none).not.toHaveBeenCalled();
    expect(webhook).not.toHaveBeenCalled();
  });

  it('returns 404 when the email is valid but no matching user exists', async () => {
    if (!server) {
      throw new Error('Server was not initialized.');
    }

    currentUser = null;

    const response = await postJson(server, '/download', {
      email: 'valid@email.com',
    });

    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('User not found');
    expect(db.oneOrNone).toHaveBeenCalledTimes(1);
    expect(db.none).not.toHaveBeenCalled();
    expect(webhook).not.toHaveBeenCalled();
  });

  it('currently returns 500 once the limiter rejects on the 4th request', async () => {
    if (!server) {
      throw new Error('Server was not initialized.');
    }

    for (let i = 0; i < 3; i += 1) {
      const warmup = await postJson(server, '/download', {
        email: 'valid@email.com',
      });

      expect(warmup.status).toBe(200);
    }

    const response = await postJson(server, '/download', {
      email: 'valid@email.com',
    });

    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });

  it('returns 500 if the downstream webhook throws', async () => {
    if (!server) {
      throw new Error('Server was not initialized.');
    }

    webhook.mockRejectedValueOnce(new Error('webhook failed'));

    const response = await postJson(server, '/download', {
      email: 'valid@email.com',
    });

    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(db.oneOrNone).toHaveBeenCalledTimes(1);
    expect(db.none).toHaveBeenCalledTimes(1);
    expect(webhook).toHaveBeenCalledTimes(1);
  });
});