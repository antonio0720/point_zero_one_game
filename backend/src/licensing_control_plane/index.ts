/**
 * Licensing Control Plane API — Production Implementation
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/licensing_control_plane/index.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * Bug killed:
 *   1. BullMQ TODO comment → real queue implementation:
 *      - `RosterImportQueue` class wraps BullMQ `Queue` with typed job data
 *      - `buildLicensingRouter(ds, queue)` accepts the queue as an injectable dep
 *      - POST /roster-imports enqueues with jobId = importId for dedup
 *      - `createRosterImportQueue(redisOpts)` factory for bootstrap/DI binding
 *      - Job data: `{ importId, cohortId, fileUrl, format, enqueuedAt }`
 *      - Concurrency/retry config: 3 attempts, exponential backoff, 5s delay
 */

import express, { Request, Response, NextFunction } from 'express';
import { DataSource, Repository, MoreThan }          from 'typeorm';
import Joi                                            from 'joi';
import { Queue, QueueOptions }                        from 'bullmq';

// ── Entity imports ─────────────────────────────────────────────────────────
import { Institution }         from '../entities/institution.entity';
import { Cohort }              from '../entities/cohort.entity';
import { RosterImport }        from '../entities/roster_import.entity';
import { PackAssignment }      from '../entities/pack_assignment.entity';
import { BenchmarkScheduling } from '../entities/benchmark_scheduling.entity';

// ── Types ─────────────────────────────────────────────────────────────────
export type ReportType  = 'completion' | 'engagement' | 'leaderboard' | 'roster';
export type ExportFormat = 'csv' | 'json' | 'xlsx';

// ── Queue types ───────────────────────────────────────────────────────────

/** Job data pushed onto the roster-import BullMQ queue */
export interface RosterImportJobData {
  importId:    number;
  cohortId:    number;
  fileUrl:     string;
  format:      'csv' | 'json';
  enqueuedAt:  string;   // ISO 8601
}

/** Queue name constant — used by both producer (here) and consumer (worker) */
export const ROSTER_IMPORT_QUEUE_NAME = 'roster-import';

/**
 * Typed wrapper around the BullMQ Queue for roster imports.
 * Provides a clean add() method with defaults and dedup via jobId.
 */
export class RosterImportQueue {
  private readonly q: Queue<RosterImportJobData>;

  constructor(q: Queue<RosterImportJobData>) {
    this.q = q;
  }

  /**
   * Enqueues a roster import job.
   *
   * jobId = `roster-import:${importId}` — BullMQ deduplicates by jobId within
   * the queue so re-submissions (e.g. from retried HTTP requests) don't
   * produce duplicate processing.
   *
   * Retry config:
   *   - 3 attempts total
   *   - Exponential backoff: 5s, 10s, 20s
   *   - removeOnComplete: keep 100 completed jobs for debugging
   */
  async add(data: RosterImportJobData): Promise<void> {
    await this.q.add(
      ROSTER_IMPORT_QUEUE_NAME,
      data,
      {
        jobId:    `roster-import:${data.importId}`,
        attempts: 3,
        backoff:  {
          type:  'exponential',
          delay: 5_000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    );
  }

  /** Drain the queue (test/dev use only) */
  async drain(): Promise<void> {
    await this.q.drain();
  }

  /** Close the underlying connection */
  async close(): Promise<void> {
    await this.q.close();
  }
}

/**
 * Factory — creates a RosterImportQueue connected to the given Redis instance.
 * In NestJS, bind this to a provider and inject via DI.
 *
 * @example
 *   const queue = createRosterImportQueue({ host: 'localhost', port: 6379 });
 */
export function createRosterImportQueue(
  redisOpts: { host: string; port: number; password?: string },
): RosterImportQueue {
  const rawQueue = new Queue<RosterImportJobData>(ROSTER_IMPORT_QUEUE_NAME, {
    connection: redisOpts,
    defaultJobOptions: {
      attempts:         3,
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50 },
    },
  });
  return new RosterImportQueue(rawQueue);
}

// ── Validation schemas ─────────────────────────────────────────────────────
const schemas = {
  institution: Joi.object({
    name:       Joi.string().min(2).max(128).required(),
    domain:     Joi.string().max(128).optional(),
    adminEmail: Joi.string().email().optional(),
  }),

  cohort: Joi.object({
    institutionId: Joi.number().integer().positive().required(),
    name:          Joi.string().min(1).max(128).required(),
    startDate:     Joi.string().isoDate().optional(),
    endDate:       Joi.string().isoDate().optional(),
  }),

  rosterImport: Joi.object({
    cohortId: Joi.number().integer().positive().required(),
    fileUrl:  Joi.string().uri().required(),
    format:   Joi.string().valid('csv', 'json').default('csv'),
  }),

  packAssignment: Joi.object({
    cohortId: Joi.number().integer().positive().required(),
    packId:   Joi.number().integer().positive().required(),
    startsAt: Joi.string().isoDate().optional(),
    endsAt:   Joi.string().isoDate().optional(),
  }),

  benchmarkScheduling: Joi.object({
    cohortId:  Joi.number().integer().positive().required(),
    startTime: Joi.string().isoDate().required(),
    endTime:   Joi.string().isoDate().required(),
    packId:    Joi.number().integer().positive().optional(),
  }),
};

// ── Validation middleware ──────────────────────────────────────────────────
function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }
    req.body = value;
    next();
  };
}

// ── Async handler wrapper ──────────────────────────────────────────────────
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

// ── Router factory ─────────────────────────────────────────────────────────

/**
 * Builds the licensing control plane Express router.
 *
 * @param ds     TypeORM DataSource (injected from your DI container)
 * @param queue  RosterImportQueue — created via createRosterImportQueue() or NestJS DI
 */
export function buildLicensingRouter(ds: DataSource, queue: RosterImportQueue) {
  const institutionRepo:    Repository<Institution>         = ds.getRepository(Institution);
  const cohortRepo:         Repository<Cohort>              = ds.getRepository(Cohort);
  const rosterImportRepo:   Repository<RosterImport>        = ds.getRepository(RosterImport);
  const packAssignmentRepo: Repository<PackAssignment>      = ds.getRepository(PackAssignment);
  const benchmarkRepo:      Repository<BenchmarkScheduling> = ds.getRepository(BenchmarkScheduling);

  const router = express.Router();

  // ── INSTITUTIONS ───────────────────────────────────────────────────────

  router.get('/institutions', asyncHandler(async (req, res) => {
    const { page = '1', limit = '50', search } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit, 10), 200);
    const skip = (parseInt(page, 10) - 1) * take;

    const qb = institutionRepo.createQueryBuilder('i').orderBy('i.name', 'ASC');
    if (search) qb.where('LOWER(i.name) LIKE :s', { s: `%${search.toLowerCase()}%` });

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();
    res.json({ items, total, page: parseInt(page, 10), limit: take });
  }));

  router.get('/institutions/:id', asyncHandler(async (req, res) => {
    const inst = await institutionRepo.findOne({ where: { id: +req.params.id } });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });
    res.json(inst);
  }));

  router.post('/institutions', validate(schemas.institution), asyncHandler(async (req, res) => {
    const inst = institutionRepo.create(req.body);
    await institutionRepo.save(inst);
    res.status(201).json(inst);
  }));

  router.put('/institutions/:id', validate(schemas.institution), asyncHandler(async (req, res) => {
    const result = await institutionRepo.update(+req.params.id, req.body);
    if (!result.affected) return res.status(404).json({ error: 'Institution not found' });
    const updated = await institutionRepo.findOne({ where: { id: +req.params.id } });
    res.json(updated);
  }));

  router.delete('/institutions/:id', asyncHandler(async (req, res) => {
    const cohortCount = await cohortRepo.count({ where: { institutionId: +req.params.id } });
    if (cohortCount > 0) {
      return res.status(409).json({
        error:       'Cannot delete institution with active cohorts',
        cohortCount,
      });
    }
    const result = await institutionRepo.delete(+req.params.id);
    if (!result.affected) return res.status(404).json({ error: 'Institution not found' });
    res.json({ success: true, id: +req.params.id });
  }));

  // ── COHORTS ────────────────────────────────────────────────────────────

  router.get('/cohorts', asyncHandler(async (req, res) => {
    const { institutionId, page = '1', limit = '50' } = req.query as Record<string, string>;
    const take  = Math.min(parseInt(limit, 10), 200);
    const skip  = (parseInt(page, 10) - 1) * take;
    const where = institutionId ? { institutionId: +institutionId } : {};
    const [items, total] = await cohortRepo.findAndCount({
      where, skip, take, order: { name: 'ASC' },
    });
    res.json({ items, total, page: parseInt(page, 10), limit: take });
  }));

  router.get('/cohorts/:id', asyncHandler(async (req, res) => {
    const cohort = await cohortRepo.findOne({
      where: { id: +req.params.id },
      relations: ['institution'],
    });
    if (!cohort) return res.status(404).json({ error: 'Cohort not found' });
    res.json(cohort);
  }));

  router.post('/cohorts', validate(schemas.cohort), asyncHandler(async (req, res) => {
    const inst = await institutionRepo.findOne({ where: { id: req.body.institutionId } });
    if (!inst) return res.status(404).json({ error: 'Institution not found' });
    const cohort = cohortRepo.create(req.body);
    await cohortRepo.save(cohort);
    res.status(201).json(cohort);
  }));

  router.put('/cohorts/:id', validate(schemas.cohort), asyncHandler(async (req, res) => {
    const result = await cohortRepo.update(+req.params.id, req.body);
    if (!result.affected) return res.status(404).json({ error: 'Cohort not found' });
    const updated = await cohortRepo.findOne({ where: { id: +req.params.id } });
    res.json(updated);
  }));

  router.delete('/cohorts/:id', asyncHandler(async (req, res) => {
    const result = await cohortRepo.delete(+req.params.id);
    if (!result.affected) return res.status(404).json({ error: 'Cohort not found' });
    res.json({ success: true, id: +req.params.id });
  }));

  // ── ROSTER IMPORTS ─────────────────────────────────────────────────────

  router.get('/roster-imports', asyncHandler(async (req, res) => {
    const { cohortId } = req.query as Record<string, string>;
    const where = cohortId ? { cohortId: +cohortId } : {};
    const items = await rosterImportRepo.find({
      where, order: { createdAt: 'DESC' }, take: 100,
    });
    res.json({ items, total: items.length });
  }));

  router.post('/roster-imports', validate(schemas.rosterImport), asyncHandler(async (req, res) => {
    const cohort = await cohortRepo.findOne({ where: { id: req.body.cohortId } });
    if (!cohort) return res.status(404).json({ error: 'Cohort not found' });

    const imp = rosterImportRepo.create({
      ...req.body,
      status:     'pending',
      importedAt: new Date(),
    });
    await rosterImportRepo.save(imp);

    // Enqueue async BullMQ job to parse and import roster.
    // jobId = 'roster-import:{importId}' — BullMQ deduplicates duplicate submissions.
    // Worker reads job.data.importId, fetches fileUrl, parses CSV/JSON, writes players.
    await queue.add({
      importId:   imp.id,
      cohortId:   req.body.cohortId,
      fileUrl:    req.body.fileUrl,
      format:     req.body.format ?? 'csv',
      enqueuedAt: new Date().toISOString(),
    });

    res.status(202).json({ ...imp, message: 'Roster import queued for processing' });
  }));

  // ── PACK ASSIGNMENT ────────────────────────────────────────────────────

  router.get('/pack-assignment', asyncHandler(async (req, res) => {
    const { cohortId } = req.query as Record<string, string>;
    const where = cohortId ? { cohortId: +cohortId } : {};
    const items = await packAssignmentRepo.find({ where, order: { createdAt: 'DESC' } });
    res.json({ items, total: items.length });
  }));

  router.post('/pack-assignment', validate(schemas.packAssignment), asyncHandler(async (req, res) => {
    const existing = await packAssignmentRepo.findOne({
      where: { cohortId: req.body.cohortId, packId: req.body.packId, active: true },
    });
    if (existing) {
      return res.status(409).json({
        error:      'Active pack assignment already exists for this cohort/pack',
        existingId: existing.id,
      });
    }
    const assignment = packAssignmentRepo.create({ ...req.body, active: true });
    await packAssignmentRepo.save(assignment);
    res.status(201).json(assignment);
  }));

  // ── BENCHMARK SCHEDULING ───────────────────────────────────────────────

  router.get('/benchmark-scheduling', asyncHandler(async (req, res) => {
    const { cohortId, upcoming } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (cohortId) where.cohortId   = +cohortId;
    if (upcoming === 'true') where.startTime = MoreThan(new Date());
    const items = await benchmarkRepo.find({ where, order: { startTime: 'ASC' } });
    res.json({ items, total: items.length });
  }));

  router.post('/benchmark-scheduling', validate(schemas.benchmarkScheduling), asyncHandler(async (req, res) => {
    const start = new Date(req.body.startTime);
    const end   = new Date(req.body.endTime);
    if (end <= start) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    const conflict = await benchmarkRepo
      .createQueryBuilder('b')
      .where('b.cohortId = :cid', { cid: req.body.cohortId })
      .andWhere('b.startTime < :end AND b.endTime > :start', {
        start: start.toISOString(),
        end:   end.toISOString(),
      })
      .getOne();

    if (conflict) {
      return res.status(409).json({
        error:          'Benchmark scheduling conflict for this cohort',
        conflictId:     conflict.id,
        conflictWindow: { start: conflict.startTime, end: conflict.endTime },
      });
    }

    const sched = benchmarkRepo.create(req.body);
    await benchmarkRepo.save(sched);
    res.status(201).json(sched);
  }));

  // ── REPORTING ──────────────────────────────────────────────────────────

  router.get('/reports/:reportType', asyncHandler(async (req, res) => {
    const reportType = req.params.reportType as ReportType;
    const { cohortId, institutionId, from, to } = req.query as Record<string, string>;

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000);
    const toDate   = to   ? new Date(to)   : new Date();

    switch (reportType) {
      case 'completion': {
        const qb = packAssignmentRepo.createQueryBuilder('pa')
          .leftJoinAndSelect('pa.cohort', 'c')
          .where('pa.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate });
        if (cohortId)      qb.andWhere('pa.cohortId = :cid',       { cid: +cohortId });
        if (institutionId) qb.andWhere('c.institutionId = :iid',   { iid: +institutionId });
        return res.json({ reportType, from: fromDate, to: toDate, data: await qb.getMany() });
      }
      case 'engagement': {
        const qb = benchmarkRepo.createQueryBuilder('b')
          .leftJoinAndSelect('b.cohort', 'c')
          .where('b.startTime BETWEEN :from AND :to', { from: fromDate, to: toDate });
        if (cohortId) qb.andWhere('b.cohortId = :cid', { cid: +cohortId });
        return res.json({ reportType, from: fromDate, to: toDate, data: await qb.getMany() });
      }
      case 'roster': {
        if (!cohortId) return res.status(400).json({ error: 'cohortId required for roster report' });
        const data = await rosterImportRepo.find({
          where: { cohortId: +cohortId }, order: { createdAt: 'DESC' },
        });
        return res.json({ reportType, cohortId: +cohortId, data });
      }
      case 'leaderboard': {
        const data = await cohortRepo
          .createQueryBuilder('c')
          .leftJoinAndSelect('c.packAssignments', 'pa')
          .orderBy('COUNT(pa.id)', 'DESC')
          .groupBy('c.id')
          .take(20)
          .getMany();
        return res.json({ reportType, data });
      }
      default:
        return res.status(400).json({ error: `Unknown report type: ${reportType}` });
    }
  }));

  // ── EXPORTS ────────────────────────────────────────────────────────────

  router.get('/exports/:exportType', asyncHandler(async (req, res) => {
    const exportType = req.params.exportType;
    const format     = (req.query.format ?? 'csv') as ExportFormat;
    const { cohortId } = req.query as Record<string, string>;

    if (!['csv', 'json', 'xlsx'].includes(format)) {
      return res.status(400).json({ error: `Unsupported format: ${format}` });
    }

    let rows: Record<string, unknown>[] = [];

    switch (exportType) {
      case 'institutions':
        rows = await institutionRepo.find({ order: { name: 'ASC' } });
        break;
      case 'cohorts':
        rows = await cohortRepo.find({
          where: cohortId ? { institutionId: +cohortId } : {},
          order: { name: 'ASC' },
        });
        break;
      case 'roster':
        if (!cohortId) return res.status(400).json({ error: 'cohortId required' });
        rows = await rosterImportRepo.find({ where: { cohortId: +cohortId } });
        break;
      case 'benchmarks':
        rows = await benchmarkRepo.find({ order: { startTime: 'ASC' } });
        break;
      default:
        return res.status(400).json({ error: `Unknown export type: ${exportType}` });
    }

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${exportType}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.json(rows);
    }

    if (format === 'csv') {
      if (!rows.length) {
        res.setHeader('Content-Disposition', `attachment; filename="${exportType}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send('');
      }
      const headers = Object.keys(rows[0]).join(',');
      const csv = [
        headers,
        ...rows.map(r =>
          Object.values(r).map(v =>
            typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v ?? '')
          ).join(',')
        ),
      ].join('\n');

      res.setHeader('Content-Disposition', `attachment; filename="${exportType}.csv"`);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csv);
    }

    return res.status(501).json({
      error:    'XLSX export requires exceljs integration',
      fallback: 'Use format=json or format=csv',
    });
  }));

  // ── ERROR HANDLER ──────────────────────────────────────────────────────
  router.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('[LicensingControlPlane]', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });

  return router;
}

// ── Bootstrap (standalone mode) ────────────────────────────────────────────
export function bootstrapLicensingApp(
  ds:         DataSource,
  queue:      RosterImportQueue,
  port = 3001,
) {
  const app = express();
  app.use(express.json());
  app.use('/api', buildLicensingRouter(ds, queue));
  app.listen(port, () => {
    console.log(`[LicensingControlPlane] Running on port ${port}`);
  });
  return app;
}
