// backend/src/analytics/core/analytics_validation.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS CORE / RUNTIME VALIDATION
 * backend/src/analytics/core/analytics_validation.ts
 *
 * Shared runtime guards and normalization for all analytics contracts.
 *
 * Design goals:
 * - zero unchecked casts for trust-critical telemetry
 * - deterministic normalization for logs/outbox/storage
 * - no external schema dependency required for core usage
 * - safe for Express, workers, cron, and replay jobs
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  ANALYTICS_EVENT_NAME_SET,
  ANALYTICS_SCHEMA_VERSION,
  ANALYTICS_SOURCE_SET,
  EXPLORER_VIEW_TYPE_SET,
  GAME_MODE_SET,
  INTEGRITY_STATUS_SET,
  RUN_OUTCOME_SET,
  RUN_PHASE_SET,
  TRUST_SURFACE_SET,
  VERIFIED_GRADE_SET,
  VISIBILITY_SCOPE_SET,
  type AnalyticsEventName,
  type AnalyticsSource,
  type ExplorerViewType,
  type GameMode,
  type IntegrityStatus,
  type RunOutcome,
  type RunPhase,
  type TrustSurfaceName,
  type VerifiedGrade,
  type VisibilityScope,
} from './analytics_names';

export type AnalyticsIdentifier = string | number;
export type AnalyticsMetadataValue = string | number | boolean | null;
export type AnalyticsMetadata = Readonly<Record<string, AnalyticsMetadataValue>>;

const VERSION_TOKEN_REGEX = /^[A-Za-z0-9._:@/-]{1,128}$/;
const UUIDISH_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX_REGEX = /^[A-Fa-f0-9]{64}$/;

function hasValue<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null;
}

function assertCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function compactUndefined<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, entry] of Object.entries(value) as Array<[keyof T, T[keyof T]]>) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }

  return result;
}

export function normalizeNonEmptyString(
  value: string | null | undefined,
  fieldName: string,
): string {
  assertCondition(hasValue(value), `${fieldName} is required.`);
  const normalized = value.trim();
  assertCondition(normalized.length > 0, `${fieldName} cannot be empty.`);
  return normalized;
}

export function normalizeOptionalString(
  value: string | null | undefined,
): string | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeIdentifier(
  value: AnalyticsIdentifier | null | undefined,
  fieldName: string,
): AnalyticsIdentifier {
  assertCondition(hasValue(value), `${fieldName} is required.`);

  if (typeof value === 'number') {
    assertCondition(
      Number.isFinite(value),
      `${fieldName} must be a finite number.`,
    );
    return value;
  }

  return normalizeNonEmptyString(value, fieldName);
}

export function normalizeOptionalIdentifier(
  value: AnalyticsIdentifier | null | undefined,
  fieldName: string,
): AnalyticsIdentifier | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  return normalizeIdentifier(value, fieldName);
}

export function normalizeTimestampMs(
  value: number | null | undefined,
  fieldName: string,
  fallback: number = Date.now(),
): number {
  if (!hasValue(value)) {
    return Math.floor(fallback);
  }

  assertCondition(Number.isFinite(value), `${fieldName} must be finite.`);
  assertCondition(value >= 0, `${fieldName} cannot be negative.`);
  return Math.floor(value);
}

export function normalizeFiniteNumber(
  value: number | null | undefined,
  fieldName: string,
): number {
  assertCondition(hasValue(value), `${fieldName} is required.`);
  assertCondition(Number.isFinite(value), `${fieldName} must be finite.`);
  return value;
}

export function normalizeOptionalFiniteNumber(
  value: number | null | undefined,
  fieldName: string,
): number | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  return normalizeFiniteNumber(value, fieldName);
}

export function normalizeNonNegativeInteger(
  value: number | null | undefined,
  fieldName: string,
): number {
  assertCondition(hasValue(value), `${fieldName} is required.`);
  assertCondition(Number.isFinite(value), `${fieldName} must be finite.`);
  assertCondition(value >= 0, `${fieldName} cannot be negative.`);
  return Math.floor(value);
}

export function normalizeOptionalNonNegativeInteger(
  value: number | null | undefined,
  fieldName: string,
): number | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  return normalizeNonNegativeInteger(value, fieldName);
}

export function normalizeSchemaVersion(
  value: number | null | undefined,
): number {
  if (!hasValue(value)) {
    return ANALYTICS_SCHEMA_VERSION;
  }

  assertCondition(
    Number.isSafeInteger(value) && value > 0,
    'schemaVersion must be a positive safe integer.',
  );

  return value;
}

export function normalizeVersionToken(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalized = normalizeNonEmptyString(value, fieldName);
  assertCondition(
    VERSION_TOKEN_REGEX.test(normalized),
    `${fieldName} must match ${VERSION_TOKEN_REGEX.toString()}.`,
  );
  return normalized;
}

export function normalizeOptionalVersionToken(
  value: string | null | undefined,
  fieldName: string,
): string | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  return normalizeVersionToken(value, fieldName);
}

export function normalizeUuidish(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalized = normalizeNonEmptyString(value, fieldName);
  assertCondition(
    UUIDISH_REGEX.test(normalized),
    `${fieldName} must be a UUID-like identifier.`,
  );
  return normalized;
}

export function normalizeOptionalUuidish(
  value: string | null | undefined,
  fieldName: string,
): string | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  return normalizeUuidish(value, fieldName);
}

export function normalizeProofHash(
  value: string | null | undefined,
  fieldName: string = 'proofHash',
): string {
  const normalized = normalizeNonEmptyString(value, fieldName);
  assertCondition(
    SHA256_HEX_REGEX.test(normalized),
    `${fieldName} must be a 64-character SHA-256 hex string.`,
  );
  return normalized.toLowerCase();
}

export function normalizeOptionalProofHash(
  value: string | null | undefined,
  fieldName: string = 'proofHash',
): string | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  return normalizeProofHash(value, fieldName);
}

export function normalizeMetadata(
  metadata: AnalyticsMetadata | Record<string, unknown> | null | undefined,
): AnalyticsMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalized: Record<string, AnalyticsMetadataValue> = {};

  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    const key = rawKey.trim();

    if (key.length === 0) {
      continue;
    }

    if (rawValue === null) {
      normalized[key] = null;
      continue;
    }

    switch (typeof rawValue) {
      case 'string':
        normalized[key] = rawValue;
        break;
      case 'boolean':
        normalized[key] = rawValue;
        break;
      case 'number':
        assertCondition(
          Number.isFinite(rawValue),
          `metadata.${key} must be a finite number.`,
        );
        normalized[key] = rawValue;
        break;
      default:
        throw new Error(
          `metadata.${key} must be string | number | boolean | null.`,
        );
    }
  }

  return Object.keys(normalized).length > 0
    ? Object.freeze(normalized)
    : undefined;
}

function normalizeEnumValue<T extends string>(
  value: T | string | null | undefined,
  fieldName: string,
  allowed: ReadonlySet<string>,
): T {
  const normalized = normalizeNonEmptyString(value ?? undefined, fieldName);
  assertCondition(
    allowed.has(normalized),
    `${fieldName} must be one of: ${Array.from(allowed).join(', ')}.`,
  );
  return normalized as T;
}

function normalizeOptionalEnumValue<T extends string>(
  value: T | string | null | undefined,
  fieldName: string,
  allowed: ReadonlySet<string>,
): T | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  return normalizeEnumValue<T>(value, fieldName, allowed);
}

export function normalizeAnalyticsEventName(
  value: AnalyticsEventName | string,
): AnalyticsEventName {
  return normalizeEnumValue<AnalyticsEventName>(
    value,
    'eventName',
    ANALYTICS_EVENT_NAME_SET,
  );
}

export function normalizeAnalyticsSource(
  value: AnalyticsSource | string | null | undefined,
): AnalyticsSource {
  return normalizeEnumValue<AnalyticsSource>(
    value ?? 'backend',
    'source',
    ANALYTICS_SOURCE_SET,
  );
}

export function normalizeOptionalAnalyticsSource(
  value: AnalyticsSource | string | null | undefined,
): AnalyticsSource | undefined {
  return normalizeOptionalEnumValue<AnalyticsSource>(
    value,
    'source',
    ANALYTICS_SOURCE_SET,
  );
}

export function normalizeGameMode(
  value: GameMode | string,
): GameMode {
  return normalizeEnumValue<GameMode>(value, 'mode', GAME_MODE_SET);
}

export function normalizeOptionalGameMode(
  value: GameMode | string | null | undefined,
): GameMode | undefined {
  return normalizeOptionalEnumValue<GameMode>(value, 'mode', GAME_MODE_SET);
}

export function normalizeRunPhase(
  value: RunPhase | string,
): RunPhase {
  return normalizeEnumValue<RunPhase>(value, 'runPhase', RUN_PHASE_SET);
}

export function normalizeOptionalRunPhase(
  value: RunPhase | string | null | undefined,
): RunPhase | undefined {
  return normalizeOptionalEnumValue<RunPhase>(
    value,
    'runPhase',
    RUN_PHASE_SET,
  );
}

export function normalizeRunOutcome(
  value: RunOutcome | string,
): RunOutcome {
  return normalizeEnumValue<RunOutcome>(value, 'runOutcome', RUN_OUTCOME_SET);
}

export function normalizeOptionalRunOutcome(
  value: RunOutcome | string | null | undefined,
): RunOutcome | undefined {
  return normalizeOptionalEnumValue<RunOutcome>(
    value,
    'runOutcome',
    RUN_OUTCOME_SET,
  );
}

export function normalizeIntegrityStatus(
  value: IntegrityStatus | string,
): IntegrityStatus {
  return normalizeEnumValue<IntegrityStatus>(
    value,
    'integrityStatus',
    INTEGRITY_STATUS_SET,
  );
}

export function normalizeOptionalIntegrityStatus(
  value: IntegrityStatus | string | null | undefined,
): IntegrityStatus | undefined {
  return normalizeOptionalEnumValue<IntegrityStatus>(
    value,
    'integrityStatus',
    INTEGRITY_STATUS_SET,
  );
}

export function normalizeVisibilityScope(
  value: VisibilityScope | string,
): VisibilityScope {
  return normalizeEnumValue<VisibilityScope>(
    value,
    'visibilityScope',
    VISIBILITY_SCOPE_SET,
  );
}

export function normalizeOptionalVisibilityScope(
  value: VisibilityScope | string | null | undefined,
): VisibilityScope | undefined {
  return normalizeOptionalEnumValue<VisibilityScope>(
    value,
    'visibilityScope',
    VISIBILITY_SCOPE_SET,
  );
}

export function normalizeVerifiedGrade(
  value: VerifiedGrade | string,
): VerifiedGrade {
  return normalizeEnumValue<VerifiedGrade>(
    value,
    'grade',
    VERIFIED_GRADE_SET,
  );
}

export function normalizeOptionalVerifiedGrade(
  value: VerifiedGrade | string | null | undefined,
): VerifiedGrade | undefined {
  return normalizeOptionalEnumValue<VerifiedGrade>(
    value,
    'grade',
    VERIFIED_GRADE_SET,
  );
}

export function normalizeTrustSurfaceName(
  value: TrustSurfaceName | string,
): TrustSurfaceName {
  return normalizeEnumValue<TrustSurfaceName>(
    value,
    'surface',
    TRUST_SURFACE_SET,
  );
}

export function normalizeOptionalTrustSurfaceName(
  value: TrustSurfaceName | string | null | undefined,
): TrustSurfaceName | undefined {
  return normalizeOptionalEnumValue<TrustSurfaceName>(
    value,
    'surface',
    TRUST_SURFACE_SET,
  );
}

export function normalizeExplorerViewType(
  value: ExplorerViewType | string,
): ExplorerViewType {
  return normalizeEnumValue<ExplorerViewType>(
    value,
    'explorerViewType',
    EXPLORER_VIEW_TYPE_SET,
  );
}

export function normalizeOptionalExplorerViewType(
  value: ExplorerViewType | string | null | undefined,
): ExplorerViewType | undefined {
  return normalizeOptionalEnumValue<ExplorerViewType>(
    value,
    'explorerViewType',
    EXPLORER_VIEW_TYPE_SET,
  );
}

export function normalizeCord(
  value: number | null | undefined,
): number | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  assertCondition(Number.isFinite(value), 'cord must be finite.');
  return value;
}

export function normalizeOccurredAndEmittedAt(input: {
  occurredAt?: number | null;
  emittedAt?: number | null;
}): { occurredAt: number; emittedAt: number } {
  const occurredAt = normalizeTimestampMs(input.occurredAt, 'occurredAt');
  const emittedAtRaw = normalizeTimestampMs(
    input.emittedAt,
    'emittedAt',
    occurredAt,
  );

  return {
    occurredAt,
    emittedAt: emittedAtRaw < occurredAt ? occurredAt : emittedAtRaw,
  };
}