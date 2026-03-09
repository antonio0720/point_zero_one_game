// backend/src/entities/benchmark_run.entity.ts

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

import { Cohort } from './cohort.entity';
import { BenchmarkScheduling } from './benchmark_scheduling.entity';

export enum BenchmarkRunStatus {
  SCHEDULED = 'scheduled',
  READY = 'ready',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABANDONED = 'abandoned',
  INVALIDATED = 'invalidated',
}

export interface BenchmarkRunMetrics {
  completionSeconds?: number;
  decisionCount?: number;
  mistakeCount?: number;
  accuracyRate?: number;
  percentile?: number;
  [key: string]: unknown;
}

export interface BenchmarkRunMetadata {
  source?: string;
  assignedByUserId?: string;
  cohortLabel?: string;
  packLabel?: string;
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

function normalizeMetrics(value: unknown): BenchmarkRunMetrics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkRunMetrics;
  const normalized: BenchmarkRunMetrics = {};

  const completionSeconds = normalizeFiniteNumber(input.completionSeconds);
  if (completionSeconds !== null) {
    normalized.completionSeconds = Math.max(0, completionSeconds);
  }

  const decisionCount = normalizeFiniteNumber(input.decisionCount);
  if (decisionCount !== null) {
    normalized.decisionCount = Math.max(0, Math.trunc(decisionCount));
  }

  const mistakeCount = normalizeFiniteNumber(input.mistakeCount);
  if (mistakeCount !== null) {
    normalized.mistakeCount = Math.max(0, Math.trunc(mistakeCount));
  }

  const accuracyRate = normalizeFiniteNumber(input.accuracyRate);
  if (accuracyRate !== null) {
    normalized.accuracyRate = Math.max(0, Math.min(1, accuracyRate));
  }

  const percentile = normalizeFiniteNumber(input.percentile);
  if (percentile !== null) {
    normalized.percentile = Math.max(0, Math.min(100, percentile));
  }

  for (const [key, entry] of Object.entries(input)) {
    if (
      key === 'completionSeconds' ||
      key === 'decisionCount' ||
      key === 'mistakeCount' ||
      key === 'accuracyRate' ||
      key === 'percentile'
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

function normalizeMetadata(value: unknown): BenchmarkRunMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkRunMetadata;

  return {
    source: normalizeNullableShortText(input.source, 128) ?? undefined,
    assignedByUserId:
      normalizeNullableShortText(input.assignedByUserId, 255) ?? undefined,
    cohortLabel: normalizeNullableShortText(input.cohortLabel, 128) ?? undefined,
    packLabel: normalizeNullableShortText(input.packLabel, 128) ?? undefined,
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => normalizeShortText(tag, 64)).filter(Boolean))]
      : undefined,
  };
}

@Entity('benchmark_runs')
@Index('idx_benchmark_runs_cohort_id', ['cohortId'])
@Index('idx_benchmark_runs_benchmark_scheduling_id', ['benchmarkSchedulingId'])
@Index('idx_benchmark_runs_player_id', ['playerId'])
@Index('idx_benchmark_runs_status', ['status'])
@Index('idx_benchmark_runs_completed_at', ['completedAt'])
@Index('uq_benchmark_runs_run_key', ['runKey'], { unique: true })
@Index(
  'uq_benchmark_runs_schedule_player',
  ['benchmarkSchedulingId', 'playerId'],
  { unique: true },
)
export class BenchmarkRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cohort_id' })
  cohortId: number;

  @Column({ name: 'benchmark_scheduling_id', nullable: true })
  benchmarkSchedulingId: number | null;

  @Column({ type: 'varchar', length: 64, name: 'player_id' })
  playerId: string;

  @Column({ type: 'varchar', length: 255, name: 'run_key' })
  runKey: string;

  @Column({ type: 'varchar', length: 128, name: 'scenario_key' })
  scenarioKey: string;

  @Column({ name: 'pack_id', nullable: true })
  packId: number | null;

  @Column({
    type: 'enum',
    enum: BenchmarkRunStatus,
    default: BenchmarkRunStatus.SCHEDULED,
  })
  status: BenchmarkRunStatus;

  @Column({
    type: 'int',
    name: 'total_attempts',
    default: 0,
  })
  totalAttempts: number;

  @Column({
    type: 'int',
    name: 'best_attempt_number',
    nullable: true,
  })
  bestAttemptNumber: number | null;

  @Column({
    type: 'double precision',
    name: 'best_score',
    nullable: true,
  })
  bestScore: number | null;

  @Column({
    type: 'double precision',
    name: 'passing_score',
    nullable: true,
  })
  passingScore: number | null;

  @Column({
    type: 'double precision',
    name: 'percentile',
    nullable: true,
  })
  percentile: number | null;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({
    type: 'jsonb',
    name: 'aggregate_metrics_json',
    default: () => "'{}'::jsonb",
  })
  aggregateMetricsJson: BenchmarkRunMetrics;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: BenchmarkRunMetadata;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'error_message',
    nullable: true,
  })
  errorMessage: string | null;

  @Column({
    type: 'timestamptz',
    name: 'scheduled_for',
    nullable: true,
  })
  scheduledFor: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'started_at',
    nullable: true,
  })
  startedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'last_attempt_at',
    nullable: true,
  })
  lastAttemptAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'completed_at',
    nullable: true,
  })
  completedAt: Date | null;

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

  normalizePlayerId(): string {
    return normalizeShortText(this.playerId, 64);
  }

  normalizeRunKey(): string {
    return normalizeShortText(this.runKey, 255);
  }

  normalizeScenarioKey(): string {
    return normalizeShortText(this.scenarioKey, 128);
  }

  normalizeBestScore(): number | null {
    return normalizeFiniteNumber(this.bestScore);
  }

  normalizePassingScore(): number | null {
    return normalizeFiniteNumber(this.passingScore);
  }

  normalizePercentile(): number | null {
    const value = normalizeFiniteNumber(this.percentile);
    return value === null ? null : Math.max(0, Math.min(100, value));
  }

  normalizeTotalAttempts(): number {
    return Math.max(0, Math.trunc(this.totalAttempts ?? 0));
  }

  normalizeBestAttemptNumber(): number | null {
    return typeof this.bestAttemptNumber === 'number' && Number.isFinite(this.bestAttemptNumber)
      ? Math.max(1, Math.trunc(this.bestAttemptNumber))
      : null;
  }

  normalizeAggregateMetrics(): BenchmarkRunMetrics {
    return normalizeMetrics(this.aggregateMetricsJson);
  }

  normalizeMetadata(): BenchmarkRunMetadata {
    return normalizeMetadata(this.metadataJson);
  }

  setAggregateMetrics(metrics: BenchmarkRunMetrics): void {
    this.aggregateMetricsJson = normalizeMetrics(metrics);
  }

  setMetadata(metadata: BenchmarkRunMetadata): void {
    this.metadataJson = normalizeMetadata(metadata);
  }

  setMetadataValue(key: string, value: unknown): void {
    const next = this.normalizeMetadata() as Record<string, unknown>;
    next[normalizeShortText(key, 128)] = value;
    this.metadataJson = next;
  }

  getMetadataValue<T = unknown>(key: string): T | undefined {
    const metadata = this.normalizeMetadata() as Record<string, unknown>;
    return metadata[key] as T | undefined;
  }

  isScheduled(): boolean {
    return this.status === BenchmarkRunStatus.SCHEDULED;
  }

  isRunning(): boolean {
    return this.status === BenchmarkRunStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === BenchmarkRunStatus.COMPLETED;
  }

  canAttempt(): boolean {
    return (
      this.status === BenchmarkRunStatus.SCHEDULED ||
      this.status === BenchmarkRunStatus.READY ||
      this.status === BenchmarkRunStatus.RUNNING
    );
  }

  markReady(): void {
    if (this.status === BenchmarkRunStatus.SCHEDULED) {
      this.status = BenchmarkRunStatus.READY;
    }
  }

  markStarted(at: Date = new Date()): void {
    if (!this.canAttempt()) {
      throw new Error(`Cannot start benchmark run from status ${this.status}`);
    }

    this.status = BenchmarkRunStatus.RUNNING;
    this.startedAt = this.startedAt ?? at;
    this.errorMessage = null;
  }

  registerAttempt(at: Date = new Date()): void {
    this.totalAttempts = this.normalizeTotalAttempts() + 1;
    this.lastAttemptAt = at;

    if (this.status === BenchmarkRunStatus.SCHEDULED || this.status === BenchmarkRunStatus.READY) {
      this.status = BenchmarkRunStatus.RUNNING;
      this.startedAt = this.startedAt ?? at;
    }
  }

  applyAttemptResult(input: {
    attemptNumber: number;
    score: number | null;
    percentile?: number | null;
    passed?: boolean;
    metrics?: BenchmarkRunMetrics;
    at?: Date;
  }): void {
    const at = input.at ?? new Date();
    const attemptNumber = Math.max(1, Math.trunc(input.attemptNumber));

    this.lastAttemptAt = at;
    this.totalAttempts = Math.max(this.normalizeTotalAttempts(), attemptNumber);

    const score = normalizeFiniteNumber(input.score);
    const currentBest = this.normalizeBestScore();

    if (score !== null && (currentBest === null || score >= currentBest)) {
      this.bestScore = score;
      this.bestAttemptNumber = attemptNumber;
    }

    const percentile = normalizeFiniteNumber(input.percentile);
    if (percentile !== null) {
      this.percentile = Math.max(0, Math.min(100, percentile));
    }

    if (input.metrics) {
      this.aggregateMetricsJson = normalizeMetrics(input.metrics);
    }

    if (input.passed === true) {
      this.passed = true;
    } else if (this.normalizePassingScore() !== null && score !== null) {
      this.passed = score >= (this.normalizePassingScore() as number);
    }
  }

  markCompleted(at: Date = new Date()): void {
    this.status = BenchmarkRunStatus.COMPLETED;
    this.completedAt = at;
    this.startedAt = this.startedAt ?? at;
  }

  markFailed(message: string, at: Date = new Date()): void {
    this.status = BenchmarkRunStatus.FAILED;
    this.errorMessage = normalizeNullableShortText(message, 255) ?? 'Benchmark run failed';
    this.lastAttemptAt = at;
  }

  markAbandoned(at: Date = new Date()): void {
    this.status = BenchmarkRunStatus.ABANDONED;
    this.completedAt = at;
  }

  invalidate(reason?: string): void {
    this.status = BenchmarkRunStatus.INVALIDATED;
    this.errorMessage =
      normalizeNullableShortText(reason, 255) ?? 'Benchmark run invalidated';
  }

  belongsToCohort(cohortId: number): boolean {
    return this.cohortId === cohortId;
  }

  belongsToPlayer(playerId: string): boolean {
    return this.normalizePlayerId() === normalizeShortText(playerId, 64);
  }
}