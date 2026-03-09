// backend/src/entities/benchmark_scoring_profile.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { BenchmarkScheduling } from './benchmark_scheduling.entity';
import { Cohort } from './cohort.entity';

export enum BenchmarkScoringProfileStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum BenchmarkScoreAggregation {
  BEST = 'best',
  LATEST = 'latest',
  AVERAGE = 'average',
}

export interface BenchmarkScoringWeights {
  scoreWeight?: number;
  speedWeight?: number;
  accuracyWeight?: number;
  consistencyWeight?: number;
  penaltyWeight?: number;
  [key: string]: unknown;
}

export interface BenchmarkNormalizationConfig {
  clampMin?: number;
  clampMax?: number;
  percentileFloor?: number;
  percentileCeiling?: number;
  precision?: number;
  [key: string]: unknown;
}

export interface BenchmarkScoringProfileMetadata {
  source?: string;
  createdByUserId?: string;
  rubricVersion?: string;
  tags?: string[];
  [key: string]: unknown;
}

function normalizeShortText(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeNullableShortText(
  value: unknown,
  maxLength: number,
): string | null {
  const normalized = normalizeShortText(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizeFiniteNumber(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeWeights(value: unknown): BenchmarkScoringWeights {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkScoringWeights;
  const normalized: BenchmarkScoringWeights = {};

  for (const [key, entry] of Object.entries(input)) {
    const numeric = normalizeFiniteNumber(entry);
    if (numeric !== null) {
      normalized[normalizeShortText(key, 128)] = numeric;
    }
  }

  return normalized;
}

function normalizeNormalizationConfig(
  value: unknown,
): BenchmarkNormalizationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkNormalizationConfig;
  const normalized: BenchmarkNormalizationConfig = {};

  const clampMin = normalizeFiniteNumber(input.clampMin);
  if (clampMin !== null) {
    normalized.clampMin = clampMin;
  }

  const clampMax = normalizeFiniteNumber(input.clampMax);
  if (clampMax !== null) {
    normalized.clampMax = clampMax;
  }

  const percentileFloor = normalizeFiniteNumber(input.percentileFloor);
  if (percentileFloor !== null) {
    normalized.percentileFloor = Math.max(0, Math.min(100, percentileFloor));
  }

  const percentileCeiling = normalizeFiniteNumber(input.percentileCeiling);
  if (percentileCeiling !== null) {
    normalized.percentileCeiling = Math.max(
      0,
      Math.min(100, percentileCeiling),
    );
  }

  const precision = normalizeFiniteNumber(input.precision);
  if (precision !== null) {
    normalized.precision = Math.max(0, Math.trunc(precision));
  }

  for (const [key, entry] of Object.entries(input)) {
    if (
      key === 'clampMin' ||
      key === 'clampMax' ||
      key === 'percentileFloor' ||
      key === 'percentileCeiling' ||
      key === 'precision'
    ) {
      continue;
    }

    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    ) {
      normalized[normalizeShortText(key, 128)] = entry;
    }
  }

  return normalized;
}

function normalizeMetadata(
  value: unknown,
): BenchmarkScoringProfileMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkScoringProfileMetadata;

  return {
    source: normalizeNullableShortText(input.source, 128) ?? undefined,
    createdByUserId:
      normalizeNullableShortText(input.createdByUserId, 255) ?? undefined,
    rubricVersion:
      normalizeNullableShortText(input.rubricVersion, 64) ?? undefined,
    tags: Array.isArray(input.tags)
      ? [
          ...new Set(
            input.tags
              .map((entry) => normalizeShortText(entry, 64))
              .filter(Boolean),
          ),
        ]
      : undefined,
  };
}

@Entity('benchmark_scoring_profiles')
@Index('idx_benchmark_scoring_profiles_cohort_id', ['cohortId'])
@Index(
  'idx_benchmark_scoring_profiles_benchmark_scheduling_id',
  ['benchmarkSchedulingId'],
)
@Index('idx_benchmark_scoring_profiles_status', ['status'])
@Index('idx_benchmark_scoring_profiles_pack_id', ['packId'])
@Index('idx_benchmark_scoring_profiles_active_from', ['activeFrom'])
@Index(
  'uq_benchmark_scoring_profiles_cohort_profile_key',
  ['cohortId', 'profileKey'],
  { unique: true },
)
export class BenchmarkScoringProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cohort_id' })
  cohortId: number;

  @Column({ name: 'benchmark_scheduling_id', nullable: true })
  benchmarkSchedulingId: number | null;

  @Column({ type: 'varchar', length: 128, name: 'profile_key' })
  profileKey: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 128, name: 'scenario_key', nullable: true })
  scenarioKey: string | null;

  @Column({ name: 'pack_id', nullable: true })
  packId: number | null;

  @Column({
    type: 'enum',
    enum: BenchmarkScoringProfileStatus,
    default: BenchmarkScoringProfileStatus.DRAFT,
  })
  status: BenchmarkScoringProfileStatus;

  @Column({
    type: 'enum',
    enum: BenchmarkScoreAggregation,
    name: 'score_aggregation',
    default: BenchmarkScoreAggregation.BEST,
  })
  scoreAggregation: BenchmarkScoreAggregation;

  @Column({ type: 'varchar', length: 32, default: '1.0.0' })
  version: string;

  @Column({
    type: 'double precision',
    name: 'passing_score',
    nullable: true,
  })
  passingScore: number | null;

  @Column({
    type: 'boolean',
    name: 'percentile_enabled',
    default: true,
  })
  percentileEnabled: boolean;

  @Column({
    type: 'boolean',
    name: 'is_default',
    default: false,
  })
  isDefault: boolean;

  @Column({
    type: 'jsonb',
    name: 'weights_json',
    default: () => "'{}'::jsonb",
  })
  weightsJson: BenchmarkScoringWeights;

  @Column({
    type: 'jsonb',
    name: 'normalization_json',
    default: () => "'{}'::jsonb",
  })
  normalizationJson: BenchmarkNormalizationConfig;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: BenchmarkScoringProfileMetadata;

  @Column({
    type: 'timestamptz',
    name: 'active_from',
    nullable: true,
  })
  activeFrom: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'active_to',
    nullable: true,
  })
  activeTo: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Cohort, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cohort_id' })
  cohort?: Cohort;

  @ManyToOne(() => BenchmarkScheduling, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'benchmark_scheduling_id' })
  benchmarkScheduling?: BenchmarkScheduling | null;

  normalizeProfileKey(): string {
    return normalizeShortText(this.profileKey, 128);
  }

  normalizeName(): string {
    return normalizeShortText(this.name, 255);
  }

  normalizeDescription(): string | null {
    return normalizeNullableShortText(this.description, 4000);
  }

  normalizeScenarioKey(): string | null {
    return normalizeNullableShortText(this.scenarioKey, 128);
  }

  normalizePassingScore(): number | null {
    return normalizeFiniteNumber(this.passingScore);
  }

  normalizeVersion(): string {
    const normalized = normalizeShortText(this.version, 32);
    return normalized.length > 0 ? normalized : '1.0.0';
  }

  normalizeWeights(): BenchmarkScoringWeights {
    return normalizeWeights(this.weightsJson);
  }

  normalizeNormalization(): BenchmarkNormalizationConfig {
    return normalizeNormalizationConfig(this.normalizationJson);
  }

  normalizeMetadata(): BenchmarkScoringProfileMetadata {
    return normalizeMetadata(this.metadataJson);
  }

  setWeights(weights: BenchmarkScoringWeights): void {
    this.weightsJson = normalizeWeights(weights);
  }

  setNormalization(config: BenchmarkNormalizationConfig): void {
    this.normalizationJson = normalizeNormalizationConfig(config);
  }

  setMetadata(metadata: BenchmarkScoringProfileMetadata): void {
    this.metadataJson = normalizeMetadata(metadata);
  }

  getMetadataValue<T = unknown>(key: string): T | undefined {
    const metadata = this.normalizeMetadata() as Record<string, unknown>;
    return metadata[key] as T | undefined;
  }

  setMetadataValue(key: string, value: unknown): void {
    const next = this.normalizeMetadata() as Record<string, unknown>;
    next[normalizeShortText(key, 128)] = value;
    this.metadataJson = next;
  }

  isDraft(): boolean {
    return this.status === BenchmarkScoringProfileStatus.DRAFT;
  }

  isActive(at: Date = new Date()): boolean {
    if (this.status !== BenchmarkScoringProfileStatus.ACTIVE) {
      return false;
    }

    if (this.activeFrom instanceof Date && this.activeFrom > at) {
      return false;
    }

    if (this.activeTo instanceof Date && this.activeTo <= at) {
      return false;
    }

    return true;
  }

  publish(at: Date = new Date()): void {
    this.status = BenchmarkScoringProfileStatus.ACTIVE;
    this.activeFrom = this.activeFrom ?? at;
  }

  archive(at: Date = new Date()): void {
    this.status = BenchmarkScoringProfileStatus.ARCHIVED;
    this.activeTo = at;
    this.isDefault = false;
  }

  shouldPass(score: number | null | undefined): boolean {
    const normalizedScore =
      typeof score === 'number' && Number.isFinite(score) ? score : null;
    const passingScore = this.normalizePassingScore();

    if (normalizedScore === null || passingScore === null) {
      return false;
    }

    return normalizedScore >= passingScore;
  }

  belongsToCohort(cohortId: number): boolean {
    return this.cohortId === cohortId;
  }
}