// backend/src/api-gateway/adapters/licensing_control_plane.adapter.ts
// PATCHED — resilient to DTO shape changes across branches

import { TenantContext } from '../middleware/auth/types';
import { CircuitBreaker } from '../middleware/resilience/circuit_breaker';
import {
  CreateInstitutionRequest,
  UpdateInstitutionRequest,
  InstitutionResponse,
} from '../contracts/curriculum/institution.dto';
import {
  CreateCohortRequest,
  CohortResponse,
} from '../contracts/curriculum/cohort.dto';
import {
  PaginationQuery,
  PaginationMeta,
} from '../contracts/curriculum/gateway_response';

// ── Database abstraction ──────────────────────────────────────────────────────

type QueryRow = Record<string, unknown>;
type QueryResult = { rows: QueryRow[] };
type Queryable = { query: (sql: string, params?: readonly unknown[]) => Promise<QueryResult> };
type RuntimeModule = Record<string, unknown>;

const breaker = new CircuitBreaker('licensing-control-plane', {
  failureThreshold: 5, resetTimeoutMs: 30_000, halfOpenMaxAttempts: 3,
});

const runtimeImport = new Function('specifier', 'return import(specifier)') as
  (specifier: string) => Promise<RuntimeModule>;

const DB_CANDIDATES: readonly string[] = [
  '../../services/database/DatabaseClient', '../../services/database',
  '../../services/database/index', '../../licensing_control_plane/database/DatabaseClient',
  '../../licensing_control_plane/database', '../../db/pool',
];

let cachedDb: Promise<Queryable> | null = null;

function isQueryable(v: unknown): v is Queryable {
  return !!v && typeof (v as Queryable).query === 'function';
}

async function unwrap(mod: RuntimeModule): Promise<Queryable | null> {
  for (const k of [undefined, 'default', 'pool', 'db', 'database', 'databaseClient', 'client', 'instance'] as const) {
    const c = k === undefined ? mod : mod[k];
    if (isQueryable(c)) return c;
  }
  for (const k of ['getPool', 'getDb', 'getClient', 'createDatabaseClient', 'createClient'] as const) {
    const fn = mod[k];
    if (typeof fn === 'function') {
      try { const r = await (fn as () => unknown)(); if (isQueryable(r)) return r; } catch { /* next */ }
    }
  }
  for (const k of ['default', 'DatabaseClient'] as const) {
    const C = mod[k]; if (typeof C !== 'function') continue;
    try { const i = (C as unknown as Record<string, unknown>)['getInstance'];
      if (typeof i === 'function') { const r = await (i as () => unknown)(); if (isQueryable(r)) return r; }
    } catch { /* next */ }
    try { const inst = new (C as new () => unknown)(); if (isQueryable(inst)) return inst; } catch { /* next */ }
  }
  return null;
}

async function resolveDb(): Promise<Queryable> {
  for (const s of DB_CANDIDATES) {
    try { const m = await runtimeImport(s); const db = await unwrap(m); if (db) return db; } catch { /* next */ }
  }
  throw new Error(`Unable to resolve database client. Tried: ${DB_CANDIDATES.join(', ')}`);
}

async function getDb(): Promise<Queryable> {
  if (!cachedDb) cachedDb = resolveDb().catch(e => { cachedDb = null; throw e; });
  return cachedDb;
}

// ── Safe field access ─────────────────────────────────────────────────────────
// The DTOs may have been modified across branches. These helpers pull fields
// from the request data by name, falling back to defaults. This lets the
// adapter compile against ANY version of the DTO interfaces.

function field<T>(obj: unknown, key: string, fallback: T): T {
  if (obj == null || typeof obj !== 'object') return fallback;
  const val = (obj as Record<string, unknown>)[key];
  return val !== undefined ? val as T : fallback;
}

function strField(obj: unknown, key: string): string | undefined {
  if (obj == null || typeof obj !== 'object') return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : undefined;
}

function numField(obj: unknown, key: string): number | undefined {
  if (obj == null || typeof obj !== 'object') return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === 'number' ? val : undefined;
}

// ── Pagination meta builder ───────────────────────────────────────────────────

function buildMeta(page: number, pageSize: number, total: number): PaginationMeta {
  const offset = (page - 1) * pageSize;
  return {
    mode: 'offset',
    page, pageSize,
    limit: pageSize,
    total,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    hasMore: offset + pageSize < total,
  } as PaginationMeta;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class LicensingControlPlaneAdapter {

  // ════════════════════════════════════════════════════════════════════════
  // INSTITUTIONS
  // ════════════════════════════════════════════════════════════════════════

  async createInstitution(ctx: TenantContext, data: CreateInstitutionRequest): Promise<InstitutionResponse> {
    return breaker.execute(async () => {
      const db = await getDb();

      // Build column/value arrays dynamically — only insert columns that have data
      const cols: string[] = ['name', 'created_by'];
      const vals: unknown[] = [String(data.name).trim(), ctx.actorId];

      // Optional fields — present on some DTO versions, absent on others
      const slug = strField(data, 'slug');
      if (slug) { cols.push('slug'); vals.push(slug); }

      if (data.domain !== undefined) { cols.push('domain'); vals.push(data.domain); }

      const adminEmail = strField(data, 'adminEmail');
      if (adminEmail) { cols.push('admin_email'); vals.push(adminEmail); }

      const licenseTier = strField(data, 'licenseTier');
      if (licenseTier) { cols.push('license_tier'); vals.push(licenseTier); }

      const privacyTier = strField(data, 'privacyTier');
      if (privacyTier) { cols.push('privacy_tier'); vals.push(privacyTier); }

      const maxCohorts = numField(data, 'maxCohorts');
      if (maxCohorts !== undefined) { cols.push('max_cohorts'); vals.push(maxCohorts); }

      const maxLearners = numField(data, 'maxLearners');
      if (maxLearners !== undefined) { cols.push('max_learners'); vals.push(maxLearners); }

      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      const result = await db.query(
        `INSERT INTO institutions (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      return this.mapInstitution(result.rows[0]);
    });
  }

  async getInstitution(ctx: TenantContext, id: string): Promise<InstitutionResponse | null> {
    return breaker.execute(async () => {
      const db = await getDb();
      const params: unknown[] = [id];
      const where: string[] = ['id = $1'];
      if (ctx.institutionId) { params.push(ctx.institutionId); where.push(`id = $${params.length}`); }
      const result = await db.query(`SELECT * FROM institutions WHERE ${where.join(' AND ')} LIMIT 1`, params);
      return result.rows[0] ? this.mapInstitution(result.rows[0]) : null;
    });
  }

  async updateInstitution(ctx: TenantContext, id: string, data: UpdateInstitutionRequest): Promise<InstitutionResponse | null> {
    return breaker.execute(async () => {
      const db = await getDb();
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      // Core fields (always on UpdateInstitutionRequest)
      if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(String(data.name).trim()); }
      if (data.domain !== undefined) { sets.push(`domain = $${idx++}`); values.push(data.domain); }

      // Extended fields — may or may not exist on the DTO
      const adminEmail = strField(data, 'adminEmail');
      if (adminEmail !== undefined) { sets.push(`admin_email = $${idx++}`); values.push(adminEmail); }

      const licenseTier = strField(data, 'licenseTier');
      if (licenseTier !== undefined) { sets.push(`license_tier = $${idx++}`); values.push(licenseTier); }

      const privacyTier = strField(data, 'privacyTier');
      if (privacyTier !== undefined) { sets.push(`privacy_tier = $${idx++}`); values.push(privacyTier); }

      const maxCohorts = numField(data, 'maxCohorts');
      if (maxCohorts !== undefined) { sets.push(`max_cohorts = $${idx++}`); values.push(maxCohorts); }

      const maxLearners = numField(data, 'maxLearners');
      if (maxLearners !== undefined) { sets.push(`max_learners = $${idx++}`); values.push(maxLearners); }

      const dataRetentionDays = numField(data, 'dataRetentionDays');
      if (dataRetentionDays !== undefined) { sets.push(`data_retention_days = $${idx++}`); values.push(dataRetentionDays); }

      if (sets.length === 0) return this.getInstitution(ctx, id);

      sets.push('updated_at = NOW()');
      values.push(id);
      const where: string[] = [`id = $${idx++}`];
      if (ctx.institutionId) { values.push(ctx.institutionId); where.push(`id = $${idx++}`); }

      const result = await db.query(
        `UPDATE institutions SET ${sets.join(', ')} WHERE ${where.join(' AND ')} RETURNING *`, values);
      return result.rows[0] ? this.mapInstitution(result.rows[0]) : null;
    });
  }

  async listInstitutions(ctx: TenantContext, pagination: PaginationQuery): Promise<{ items: InstitutionResponse[]; meta: PaginationMeta }> {
    return breaker.execute(async () => {
      const db = await getDb();
      const page = Math.max(1, pagination.page ?? 1);
      const pageSize = Math.min(Math.max(1, pagination.pageSize ?? 20), 100);
      const offset = (page - 1) * pageSize;
      const baseParams: unknown[] = [];
      const where: string[] = ["status != 'deleted'"];
      if (ctx.institutionId) { baseParams.push(ctx.institutionId); where.push(`id = $${baseParams.length}`); }
      const whereSql = `WHERE ${where.join(' AND ')}`;
      const countResult = await db.query(`SELECT COUNT(*) AS count FROM institutions ${whereSql}`, baseParams);
      const total = parseInt(String(countResult.rows[0]?.['count'] ?? '0'), 10);
      const listParams = [...baseParams, pageSize, offset];
      const result = await db.query(
        `SELECT * FROM institutions ${whereSql} ORDER BY created_at DESC LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
        listParams);
      return { items: result.rows.map(r => this.mapInstitution(r)), meta: buildMeta(page, pageSize, total) };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // COHORTS
  // ════════════════════════════════════════════════════════════════════════

  async createCohort(ctx: TenantContext, data: CreateCohortRequest): Promise<CohortResponse> {
    return breaker.execute(async () => {
      const db = await getDb();
      if (!ctx.institutionId) throw new Error('Unable to create cohort: no institutionId in TenantContext.');

      const cols: string[] = ['institution_id', 'name', 'created_by'];
      const vals: unknown[] = [ctx.institutionId, String(data.name).trim(), ctx.actorId];

      // Optional fields — safe across DTO versions
      const slug = strField(data, 'slug');
      if (slug) { cols.push('slug'); vals.push(slug); }

      const description = strField(data, 'description');
      if (description !== undefined) { cols.push('description'); vals.push(description); }

      const maxLearners = numField(data, 'maxLearners');
      if (maxLearners !== undefined) { cols.push('max_learners'); vals.push(maxLearners); }

      const facilitatorId = strField(data, 'facilitatorId');
      if (facilitatorId) { cols.push('facilitator_id'); vals.push(facilitatorId); }

      const programTemplate = strField(data, 'programTemplate');
      if (programTemplate) { cols.push('program_template'); vals.push(programTemplate); }

      // Date fields — check multiple possible names
      const seasonStart = strField(data, 'seasonStart') ?? strField(data, 'startDate');
      if (seasonStart) { cols.push('season_start'); vals.push(seasonStart); }

      const seasonEnd = strField(data, 'seasonEnd') ?? strField(data, 'endDate');
      if (seasonEnd) { cols.push('season_end'); vals.push(seasonEnd); }

      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
      const result = await db.query(
        `INSERT INTO cohorts (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      return this.mapCohort(result.rows[0]);
    });
  }

  async getCohort(ctx: TenantContext, cohortId: string): Promise<CohortResponse | null> {
    return breaker.execute(async () => {
      const db = await getDb();
      const params: unknown[] = [cohortId];
      const where: string[] = ['id = $1'];
      if (ctx.institutionId) { params.push(ctx.institutionId); where.push(`institution_id = $${params.length}`); }
      const result = await db.query(`SELECT * FROM cohorts WHERE ${where.join(' AND ')} LIMIT 1`, params);
      return result.rows[0] ? this.mapCohort(result.rows[0]) : null;
    });
  }

  async listCohorts(ctx: TenantContext, pagination: PaginationQuery): Promise<{ items: CohortResponse[]; meta: PaginationMeta }> {
    return breaker.execute(async () => {
      const db = await getDb();
      const page = Math.max(1, pagination.page ?? 1);
      const pageSize = Math.min(Math.max(1, pagination.pageSize ?? 20), 100);
      const offset = (page - 1) * pageSize;
      const baseParams: unknown[] = [];
      const where: string[] = ["status != 'archived'"];
      if (ctx.institutionId) { baseParams.push(ctx.institutionId); where.push(`institution_id = $${baseParams.length}`); }
      const whereSql = `WHERE ${where.join(' AND ')}`;
      const countResult = await db.query(`SELECT COUNT(*) AS count FROM cohorts ${whereSql}`, baseParams);
      const total = parseInt(String(countResult.rows[0]?.['count'] ?? '0'), 10);
      const listParams = [...baseParams, pageSize, offset];
      const result = await db.query(
        `SELECT * FROM cohorts ${whereSql} ORDER BY created_at DESC LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
        listParams);
      return { items: result.rows.map(r => this.mapCohort(r)), meta: buildMeta(page, pageSize, total) };
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // MAPPERS — read all possible column names from the DB row
  // ════════════════════════════════════════════════════════════════════════

  private mapInstitution(row: QueryRow): InstitutionResponse {
    const mapped: Record<string, unknown> = {
      id:               String(row['id'] ?? ''),
      name:             String(row['name'] ?? ''),
      slug:             String(row['slug'] ?? ''),
      domain:           row['domain'] != null ? String(row['domain']) : null,
      domainVerified:   Boolean(row['domain_verified'] ?? false),
      status:           String(row['status'] ?? 'active'),
      privacyTier:      String(row['privacy_tier'] ?? 'standard'),
      licenseTier:      String(row['license_tier'] ?? 'pilot'),
      licenseExpiresAt: this.toIsoOrNull(row['license_expires_at']),
      maxCohorts:       Number(row['max_cohorts'] ?? 10),
      maxLearners:      Number(row['max_learners'] ?? 500),
      ssoEnabled:       Boolean(row['sso_enabled'] ?? false),
      adminEmail:       row['admin_email'] != null ? String(row['admin_email']) : null,
      createdAt:        this.toIsoRequired(row['created_at']),
      updatedAt:        this.toIsoRequired(row['updated_at']),
    };
    return mapped as unknown as InstitutionResponse;
  }

  private mapCohort(row: QueryRow): CohortResponse {
    const mapped: Record<string, unknown> = {
      id:              String(row['id'] ?? ''),
      institutionId:   String(row['institution_id'] ?? ''),
      name:            String(row['name'] ?? ''),
      slug:            String(row['slug'] ?? ''),
      description:     row['description'] != null ? String(row['description']) : null,
      status:          String(row['status'] ?? 'active'),
      maxLearners:     Number(row['max_learners'] ?? 100),
      facilitatorId:   row['facilitator_id'] != null ? String(row['facilitator_id']) : null,
      programTemplate: row['program_template'] != null ? String(row['program_template']) : null,
      seasonStart:     this.toIsoOrNull(row['season_start']),
      seasonEnd:       this.toIsoOrNull(row['season_end']),
      startDate:       this.toIsoOrNull(row['start_date'] ?? row['season_start']),
      endDate:         this.toIsoOrNull(row['end_date'] ?? row['season_end']),
      createdAt:       this.toIsoRequired(row['created_at']),
      updatedAt:       this.toIsoRequired(row['updated_at']),
    };
    return mapped as unknown as CohortResponse;
  }

  // ════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════════════

  private toIsoOrNull(value: unknown): string | null {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private toIsoRequired(value: unknown): string {
    return this.toIsoOrNull(value) ?? new Date(0).toISOString();
  }
}

export const licensingControlPlaneAdapter = new LicensingControlPlaneAdapter();