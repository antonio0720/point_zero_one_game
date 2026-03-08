// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/routes/kit-stats.ts

import { Router, type NextFunction, type Request, type Response } from 'express';
import { Pool } from 'pg';

interface HostStatsSnapshot {
  ok: true;
  generatedAt: string;
  stats: {
    registrations: {
      total: number;
      newToday: number;
      uniqueEmails: number;
    };
    emailEvents: {
      total: number;
    };
    invites: {
      total: number;
      opened: number;
      rsvped: number;
    };
    moments: {
      total: number;
      last7Days: number;
    };
    printables: {
      total: number;
      enabled: number;
    };
  };
}

const router = Router();

const TABLES = {
  registrations: 'public.host_registrations',
  emailEvents: 'public.host_email_events',
  invites: 'public.host_invites',
  moments: 'public.host_moments',
  printables: 'public.host_printables',
} as const;

let pool: Pool | null = null;

function getDatabasePool(): Pool | null {
  const connectionString =
    process.env.HOST_OS_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null;

  if (!connectionString) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getAdminToken(): string | null {
  return (
    process.env.HOST_OS_ADMIN_TOKEN?.trim() ||
    process.env.ADMIN_API_KEY_SECRET?.trim() ||
    null
  );
}

function toInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return 0;
}

async function tableExists(regclassName: string): Promise<boolean> {
  const db = getDatabasePool();
  if (!db) {
    return false;
  }

  try {
    const result = await db.query<{ exists: boolean }>(
      'SELECT to_regclass($1) IS NOT NULL AS exists',
      [regclassName],
    );

    return Boolean(result.rows[0]?.exists);
  } catch (error) {
    console.error('[host-os][kit-stats] failed to inspect table existence', {
      regclassName,
      error,
    });
    return false;
  }
}

async function safeCount(
  regclassName: string,
  queryText: string,
): Promise<number> {
  const db = getDatabasePool();
  if (!db) {
    return 0;
  }

  const exists = await tableExists(regclassName);
  if (!exists) {
    return 0;
  }

  try {
    const result = await db.query<{ value: string | number | null }>(queryText);
    return toInteger(result.rows[0]?.value ?? 0);
  } catch (error) {
    console.error('[host-os][kit-stats] metric query failed', {
      regclassName,
      queryText,
      error,
    });
    return 0;
  }
}

async function buildStatsSnapshot(): Promise<HostStatsSnapshot> {
  const [
    registrationsTotal,
    registrationsToday,
    uniqueEmails,
    emailEventsTotal,
    invitesTotal,
    invitesOpened,
    invitesRsvped,
    momentsTotal,
    momentsLast7Days,
    printablesTotal,
    printablesEnabled,
  ] = await Promise.all([
    safeCount(
      TABLES.registrations,
      'SELECT COUNT(*)::bigint AS value FROM host_registrations',
    ),
    safeCount(
      TABLES.registrations,
      `
      SELECT COUNT(*)::bigint AS value
      FROM host_registrations
      WHERE created_at >= CURRENT_DATE
      `,
    ),
    safeCount(
      TABLES.registrations,
      `
      SELECT COUNT(DISTINCT email)::bigint AS value
      FROM host_registrations
      WHERE email IS NOT NULL AND email <> ''
      `,
    ),
    safeCount(
      TABLES.emailEvents,
      'SELECT COUNT(*)::bigint AS value FROM host_email_events',
    ),
    safeCount(
      TABLES.invites,
      'SELECT COUNT(*)::bigint AS value FROM host_invites',
    ),
    safeCount(
      TABLES.invites,
      `
      SELECT COUNT(*)::bigint AS value
      FROM host_invites
      WHERE opened_at IS NOT NULL
      `,
    ),
    safeCount(
      TABLES.invites,
      `
      SELECT COUNT(*)::bigint AS value
      FROM host_invites
      WHERE rsvp_at IS NOT NULL
      `,
    ),
    safeCount(
      TABLES.moments,
      'SELECT COUNT(*)::bigint AS value FROM host_moments',
    ),
    safeCount(
      TABLES.moments,
      `
      SELECT COUNT(*)::bigint AS value
      FROM host_moments
      WHERE created_at >= NOW() - INTERVAL '7 days'
      `,
    ),
    safeCount(
      TABLES.printables,
      'SELECT COUNT(*)::bigint AS value FROM host_printables',
    ),
    safeCount(
      TABLES.printables,
      `
      SELECT COUNT(*)::bigint AS value
      FROM host_printables
      WHERE enabled = TRUE
      `,
    ),
  ]);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    stats: {
      registrations: {
        total: registrationsTotal,
        newToday: registrationsToday,
        uniqueEmails,
      },
      emailEvents: {
        total: emailEventsTotal,
      },
      invites: {
        total: invitesTotal,
        opened: invitesOpened,
        rsvped: invitesRsvped,
      },
      moments: {
        total: momentsTotal,
        last7Days: momentsLast7Days,
      },
      printables: {
        total: printablesTotal,
        enabled: printablesEnabled,
      },
    },
  };
}

function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expectedToken = getAdminToken();
  if (!expectedToken) {
    res.status(503).json({
      ok: false,
      error: 'Admin token is not configured.',
    });
    return;
  }

  const providedToken = getBearerToken(req);
  if (!providedToken) {
    res.status(401).json({
      ok: false,
      error: 'Missing bearer token.',
    });
    return;
  }

  if (providedToken !== expectedToken) {
    res.status(403).json({
      ok: false,
      error: 'Forbidden.',
    });
    return;
  }

  next();
}

async function handleStats(_req: Request, res: Response): Promise<void> {
  const snapshot = await buildStatsSnapshot();
  res.status(200).json(snapshot);
}

router.use(requireAdmin);
router.get('/', (req: Request, res: Response) => {
  void handleStats(req, res);
});
router.get('/summary', (req: Request, res: Response) => {
  void handleStats(req, res);
});

export default router;