/**
 * Telemetry Service — Production Implementation
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/services/telemetry/index.ts
 *
 * Fixes applied:
 *   [TS2307] — DatabaseClient created at ../database/DatabaseClient
 *   [TS2322 ×8] — requireNumber / requireString now return Error | null
 *                 (were returning string | null, incompatible with Error | undefined)
 */

import { DatabaseClient } from '../database/DatabaseClient';

// ── Telemetry event data types ────────────────────────────────────────────────

export interface AssetPurchasedData {
  eventType:     'ASSET_PURCHASED';
  cardId:        string;
  cardName:      string;
  downPayment:   number;
  debt:          number;
  monthlyIncome: number;
  cashDelta:     number;
}

export interface FubarAppliedData {
  eventType:   'FUBAR_APPLIED';
  cardId:      string;
  cardName:    string;
  cashDelta:   number;
  momentLabel: string;
}

export interface FubarShieldedData {
  eventType:        'FUBAR_SHIELDED';
  cardId:           string;
  shieldsRemaining: number;
}

export interface MissedOpportunityData {
  eventType:   'MISSED_OPPORTUNITY_APPLIED';
  cardId:      string;
  turnsLost:   number;
  momentLabel: string;
}

export interface IpaBuiltData {
  eventType:     'IPA_BUILT';
  cardId:        string;
  setupCost:     number;
  monthlyIncome: number;
}

export interface IpaBuildFailedData {
  eventType: 'IPA_BUILD_FAILED';
  cardId:    string;
  reason:    'INSUFFICIENT_CASH';
}

export interface PrivilegedAppliedData {
  eventType: 'PRIVILEGED_APPLIED';
  cardId:    string;
  value:     number;
}

export interface SoDrawnData {
  eventType:    'SO_DRAWN';
  cardId:       string;
  obstacleKind: string;
  cashDelta:    number;
}

export interface OpportunityPassedData {
  eventType: 'OPPORTUNITY_PASSED';
  cardId:    string;
  reason:    string;
}

export interface WipeData {
  eventType:     'WIPE';
  reason:        'CASH_FLOOR' | 'NET_WORTH_FLOOR' | 'AUDIT_HASH_MISMATCH';
  finalCash:     number;
  finalNetWorth: number;
  turnNumber:    number;
}

export interface WinData {
  eventType:         'WIN';
  exitedRatRaceTurn: number;
  finalCash:         number;
  finalNetWorth:     number;
  passiveIncome:     number;
}

export interface PurchaseBlockedData {
  eventType: 'PURCHASE_BLOCKED_LOAN_DENIED';
  cardId:    string;
}

export interface UnknownEventData {
  eventType: string;
  [key: string]: unknown;
}

export type TelemetryEventData =
  | AssetPurchasedData
  | FubarAppliedData
  | FubarShieldedData
  | MissedOpportunityData
  | IpaBuiltData
  | IpaBuildFailedData
  | PrivilegedAppliedData
  | SoDrawnData
  | OpportunityPassedData
  | WipeData
  | WinData
  | PurchaseBlockedData
  | UnknownEventData;

// ── Metric type ───────────────────────────────────────────────────────────────

export interface Metric {
  timestamp: number;
  gameId:    string;
  playerId:  string;
  eventType: string;
  eventData: TelemetryEventData;
}

export type MetricsBatch = Metric[];

// ── Constants ─────────────────────────────────────────────────────────────────

export const ALLOWED_EVENT_TYPES = new Set<string>([
  'ASSET_PURCHASED', 'FUBAR_APPLIED', 'FUBAR_SHIELDED',
  'MISSED_OPPORTUNITY_APPLIED', 'IPA_BUILT', 'IPA_BUILD_FAILED',
  'PRIVILEGED_APPLIED', 'SO_DRAWN', 'OPPORTUNITY_PASSED',
  'WIPE', 'WIN', 'PURCHASE_BLOCKED_LOAN_DENIED',
]);

const MAX_EVENT_AGE_MS = 60 * 60 * 1000;
const BULK_BATCH_LIMIT = 500;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Helpers ───────────────────────────────────────────────────────────────────
// FIX [TS2322]: Return Error | null (not string | null) so the ?? chain in
// validate() resolves to Error | undefined — matching the function return type.

function isUUID(s: string): boolean {
  return UUID_REGEX.test(s);
}

function requireNumber(data: Record<string, unknown>, field: string): Error | null {
  const v = data[field];
  if (typeof v !== 'number' || !isFinite(v)) {
    return new Error(`eventData.${field} must be a finite number`);
  }
  return null;
}

function requireString(data: Record<string, unknown>, field: string): Error | null {
  const v = data[field];
  if (typeof v !== 'string' || !v.trim()) {
    return new Error(`eventData.${field} must be a non-empty string`);
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function ingest(
  gameId:    string,
  playerId:  string,
  eventType: string,
  eventData: TelemetryEventData,
): Promise<void> {
  const err = validate(gameId, playerId, eventType, eventData);
  if (err) throw err;

  const metric: Metric = { timestamp: Date.now(), gameId, playerId, eventType, eventData };
  await DatabaseClient.insertTelemetry(metric);
}

export async function batch(metrics: MetricsBatch): Promise<void> {
  if (!metrics.length) return;

  for (const m of metrics) {
    const err = validate(m.gameId, m.playerId, m.eventType, m.eventData);
    if (err) throw new Error(`Batch validation failed [${m.eventType}]: ${err.message}`);
  }

  await DatabaseClient.beginTransaction();
  try {
    if (metrics.length <= BULK_BATCH_LIMIT) {
      const placeholders = metrics
        .map((_, i) => {
          const b = i * 5;
          return `($${b+1}, $${b+2}, $${b+3}, $${b+4}::jsonb, $${b+5})`;
        })
        .join(', ');

      const params = metrics.flatMap(m => [
        m.gameId,
        m.playerId,
        m.eventType,
        JSON.stringify(m.eventData),
        m.timestamp,
      ]);

      await DatabaseClient.query(
        `INSERT INTO telemetry (game_id, player_id, event_type, event_data, timestamp)
         VALUES ${placeholders}
         ON CONFLICT DO NOTHING`,
        params,
      );
    } else {
      for (const m of metrics) {
        await DatabaseClient.insertTelemetry(m);
      }
    }
    await DatabaseClient.commitTransaction();
  } catch (err) {
    await DatabaseClient.rollbackTransaction();
    throw err;
  }
}

export function validate(
  gameId:     string,
  playerId:   string,
  eventType:  string,
  eventData:  TelemetryEventData,
  timestamp?: number,
): Error | undefined {
  if (!gameId || !isUUID(gameId)) {
    return new Error(`gameId must be a valid UUID v4, got: "${gameId}"`);
  }
  if (!playerId || !isUUID(playerId)) {
    return new Error(`playerId must be a valid UUID v4, got: "${playerId}"`);
  }

  if (timestamp !== undefined) {
    const now = Date.now();
    if (timestamp > now + 5_000) {
      return new Error(`timestamp ${timestamp} is in the future (now: ${now})`);
    }
    if (now - timestamp > MAX_EVENT_AGE_MS) {
      return new Error(`timestamp ${timestamp} exceeds max age of ${MAX_EVENT_AGE_MS}ms`);
    }
  }

  if (!ALLOWED_EVENT_TYPES.has(eventType)) return undefined;

  const d = eventData as Record<string, unknown>;

  switch (eventType) {
    case 'ASSET_PURCHASED': {
      return (
        requireString(d, 'cardId') ??
        requireString(d, 'cardName') ??
        requireNumber(d, 'downPayment') ??
        requireNumber(d, 'debt') ??
        requireNumber(d, 'monthlyIncome') ??
        requireNumber(d, 'cashDelta') ??
        undefined
      );
    }
    case 'FUBAR_APPLIED': {
      return (
        requireString(d, 'cardId') ??
        requireString(d, 'cardName') ??
        requireNumber(d, 'cashDelta') ??
        requireString(d, 'momentLabel') ??
        undefined
      );
    }
    case 'FUBAR_SHIELDED': {
      return requireString(d, 'cardId') ?? requireNumber(d, 'shieldsRemaining') ?? undefined;
    }
    case 'MISSED_OPPORTUNITY_APPLIED': {
      const base =
        requireString(d, 'cardId') ??
        requireString(d, 'momentLabel') ??
        requireNumber(d, 'turnsLost');
      if (base) return base;
      if ((d.turnsLost as number) < 1) return new Error('turnsLost must be >= 1');
      return undefined;
    }
    case 'IPA_BUILT': {
      return (
        requireString(d, 'cardId') ??
        requireNumber(d, 'setupCost') ??
        requireNumber(d, 'monthlyIncome') ??
        undefined
      );
    }
    case 'WIPE': {
      const base =
        requireNumber(d, 'finalCash') ??
        requireNumber(d, 'finalNetWorth') ??
        requireNumber(d, 'turnNumber');
      if (base) return base;
      const validReasons = new Set(['CASH_FLOOR', 'NET_WORTH_FLOOR', 'AUDIT_HASH_MISMATCH']);
      if (!validReasons.has(d.reason as string)) {
        return new Error('WIPE.reason must be CASH_FLOOR | NET_WORTH_FLOOR | AUDIT_HASH_MISMATCH');
      }
      return undefined;
    }
    case 'WIN': {
      return (
        requireNumber(d, 'exitedRatRaceTurn') ??
        requireNumber(d, 'finalCash') ??
        requireNumber(d, 'finalNetWorth') ??
        requireNumber(d, 'passiveIncome') ??
        undefined
      );
    }
    default: {
      return requireString(d, 'cardId') ?? undefined;
    }
  }
}

export async function persist(metric: Metric): Promise<void> {
  await DatabaseClient.insertTelemetry(metric);
}

// ── Rollup ────────────────────────────────────────────────────────────────────

export interface RollupRow {
  eventType:       string;
  eventCount:      number;
  cashDeltaSum:    number | null;
  avgPayloadBytes: number;
  periodStart:     number;
  periodEnd:       number;
  computedAt:      number;
}

export async function rollup(startTimestamp: number, endTimestamp: number): Promise<RollupRow[]> {
  if (endTimestamp <= startTimestamp) {
    throw new Error(`rollup: endTimestamp must be > startTimestamp`);
  }

  const rows = await DatabaseClient.query<{
    event_type:        string;
    event_count:       string;
    cash_delta_sum:    string | null;
    avg_payload_bytes: string;
  }>(
    `SELECT
       event_type,
       COUNT(*)::text                                           AS event_count,
       SUM(
         CASE WHEN event_type = 'FUBAR_APPLIED'
              THEN (event_data->>'cashDelta')::numeric
              ELSE NULL
         END
       )::text                                                  AS cash_delta_sum,
       AVG(LENGTH(event_data::text))::text                      AS avg_payload_bytes
     FROM telemetry
     WHERE timestamp >= $1
       AND timestamp <  $2
     GROUP BY event_type`,
    [startTimestamp, endTimestamp],
  );

  if (!rows.length) return [];

  const computedAt = Date.now();

  const placeholders = rows
    .map((_, i) => {
      const b = i * 7;
      return `($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, $${b+6}, $${b+7})`;
    })
    .join(', ');

  const params = rows.flatMap(r => [
    startTimestamp,
    endTimestamp,
    r.event_type,
    parseInt(r.event_count, 10),
    r.cash_delta_sum !== null ? parseFloat(r.cash_delta_sum) : null,
    parseFloat(r.avg_payload_bytes),
    computedAt,
  ]);

  await DatabaseClient.query(
    `INSERT INTO telemetry_rollups
       (period_start, period_end, event_type, event_count, cash_delta_sum, avg_payload_bytes, computed_at)
     VALUES ${placeholders}
     ON CONFLICT (period_start, event_type) DO UPDATE SET
       event_count       = EXCLUDED.event_count,
       cash_delta_sum    = EXCLUDED.cash_delta_sum,
       avg_payload_bytes = EXCLUDED.avg_payload_bytes,
       computed_at       = EXCLUDED.computed_at`,
    params,
  );

  return rows.map(r => ({
    eventType:       r.event_type,
    eventCount:      parseInt(r.event_count, 10),
    cashDeltaSum:    r.cash_delta_sum !== null ? parseFloat(r.cash_delta_sum) : null,
    avgPayloadBytes: parseFloat(r.avg_payload_bytes),
    periodStart:     startTimestamp,
    periodEnd:       endTimestamp,
    computedAt,
  }));
}