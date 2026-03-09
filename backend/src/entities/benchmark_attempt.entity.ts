// backend/src/entities/benchmark_attempt.entity.ts

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

import { BenchmarkRun } from './benchmark_run.entity';

export enum BenchmarkAttemptStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABANDONED = 'abandoned',
  INVALIDATED = 'invalidated',
}

export interface BenchmarkAttemptTelemetry {
  latencyMs?: number;
  durationMs?: number;
  decisionCount?: number;
  retryCount?: number;
  exitReason?: string;
  [key: string]: unknown;
}

export interface BenchmarkAttemptFeedback {
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  coachNotes?: string[];
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

function normalizeTelemetry(value: unknown): BenchmarkAttemptTelemetry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkAttemptTelemetry;
  const normalized: BenchmarkAttemptTelemetry = {};

  const latencyMs = normalizeFiniteNumber(input.latencyMs);
  if (latencyMs !== null) {
    normalized.latencyMs = Math.max(0, Math.trunc(latencyMs));
  }

  const durationMs = normalizeFiniteNumber(input.durationMs);
  if (durationMs !== null) {
    normalized.durationMs = Math.max(0, Math.trunc(durationMs));
  }

  const decisionCount = normalizeFiniteNumber(input.decisionCount);
  if (decisionCount !== null) {
    normalized.decisionCount = Math.max(0, Math.trunc(decisionCount));
  }

  const retryCount = normalizeFiniteNumber(input.retryCount);
  if (retryCount !== null) {
    normalized.retryCount = Math.max(0, Math.trunc(retryCount));
  }

  const exitReason = normalizeNullableShortText(input.exitReason, 128);
  if (exitReason) {
    normalized.exitReason = exitReason;
  }

  for (const [key, entry] of Object.entries(input)) {
    if (
      key === 'latencyMs' ||
      key === 'durationMs' ||
      key === 'decisionCount' ||
      key === 'retryCount' ||
      key === 'exitReason'
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

function normalizeFeedback(value: unknown): BenchmarkAttemptFeedback {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkAttemptFeedback;

  return {
    summary: normalizeNullableShortText(input.summary, 2000) ?? undefined,
    strengths: Array.isArray(input.strengths)
      ? [...new Set(input.strengths.map((entry) => normalizeShortText(entry, 255)).filter(Boolean))]
      : undefined,
    weaknesses: Array.isArray(input.weaknesses)
      ? [...new Set(input.weaknesses.map((entry) => normalizeShortText(entry, 255)).filter(Boolean))]
      : undefined,
    coachNotes: Array.isArray(input.coachNotes)
      ? [...new Set(input.coachNotes.map((entry) => normalizeShortText(entry, 255)).filter(Boolean))]
      : undefined,
  };
}

@Entity('benchmark_attempts')
@Index('idx_benchmark_attempts_benchmark_run_id', ['benchmarkRunId'])
@Index('idx_benchmark_attempts_status', ['status'])
@Index('idx_benchmark_attempts_completed_at', ['completedAt'])
@Index('idx_benchmark_attempts_engine_run_id', ['engineRunId'])
@Index('uq_benchmark_attempts_run_number', ['benchmarkRunId', 'attemptNumber'], {
  unique: true,
})
@Index('uq_benchmark_attempts_attempt_key', ['attemptKey'], { unique: true })
export class BenchmarkAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'benchmark_run_id' })
  benchmarkRunId: number;

  @Column({ type: 'varchar', length: 255, name: 'attempt_key' })
  attemptKey: string;

  @Column({ type: 'int', name: 'attempt_number' })
  attemptNumber: number;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'engine_run_id',
    nullable: true,
  })
  engineRunId: string | null;

  @Column({
    type: 'enum',
    enum: BenchmarkAttemptStatus,
    default: BenchmarkAttemptStatus.QUEUED,
  })
  status: BenchmarkAttemptStatus;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  score: number | null;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  percentile: number | null;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({
    type: 'jsonb',
    name: 'telemetry_json',
    default: () => "'{}'::jsonb",
  })
  telemetryJson: BenchmarkAttemptTelemetry;

  @Column({
    type: 'jsonb',
    name: 'feedback_json',
    default: () => "'{}'::jsonb",
  })
  feedbackJson: BenchmarkAttemptFeedback;

  @Column({
    type: 'jsonb',
    name: 'result_json',
    default: () => "'{}'::jsonb",
  })
  resultJson: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'error_message',
    nullable: true,
  })
  errorMessage: string | null;

  @Column({
    type: 'timestamptz',
    name: 'started_at',
    nullable: true,
  })
  startedAt: Date | null;

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

  @ManyToOne(() => BenchmarkRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'benchmark_run_id' })
  benchmarkRun?: BenchmarkRun;

  normalizeAttemptKey(): string {
    return normalizeShortText(this.attemptKey, 255);
  }

  normalizeAttemptNumber(): number {
    return Math.max(1, Math.trunc(this.attemptNumber ?? 1));
  }

  normalizeEngineRunId(): string | null {
    return normalizeNullableShortText(this.engineRunId, 255);
  }

  normalizeScore(): number | null {
    return normalizeFiniteNumber(this.score);
  }

  normalizePercentile(): number | null {
    const value = normalizeFiniteNumber(this.percentile);
    return value === null ? null : Math.max(0, Math.min(100, value));
  }

  normalizeTelemetry(): BenchmarkAttemptTelemetry {
    return normalizeTelemetry(this.telemetryJson);
  }

  normalizeFeedback(): BenchmarkAttemptFeedback {
    return normalizeFeedback(this.feedbackJson);
  }

  normalizeResult(): Record<string, unknown> {
    if (!this.resultJson || typeof this.resultJson !== 'object' || Array.isArray(this.resultJson)) {
      return {};
    }

    return { ...this.resultJson };
  }

  setTelemetry(telemetry: BenchmarkAttemptTelemetry): void {
    this.telemetryJson = normalizeTelemetry(telemetry);
  }

  setFeedback(feedback: BenchmarkAttemptFeedback): void {
    this.feedbackJson = normalizeFeedback(feedback);
  }

  setResult(result: Record<string, unknown>): void {
    this.resultJson =
      result && typeof result === 'object' && !Array.isArray(result)
        ? { ...result }
        : {};
  }

  setResultValue(key: string, value: unknown): void {
    const next = this.normalizeResult();
    next[normalizeShortText(key, 128)] = value;
    this.resultJson = next;
  }

  getResultValue<T = unknown>(key: string): T | undefined {
    const result = this.normalizeResult();
    return result[key] as T | undefined;
  }

  isQueued(): boolean {
    return this.status === BenchmarkAttemptStatus.QUEUED;
  }

  isRunning(): boolean {
    return this.status === BenchmarkAttemptStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === BenchmarkAttemptStatus.COMPLETED;
  }

  isTerminal(): boolean {
    return (
      this.status === BenchmarkAttemptStatus.COMPLETED ||
      this.status === BenchmarkAttemptStatus.FAILED ||
      this.status === BenchmarkAttemptStatus.ABANDONED ||
      this.status === BenchmarkAttemptStatus.INVALIDATED
    );
  }

  markRunning(input?: {
    at?: Date;
    engineRunId?: string | null;
  }): void {
    if (
      this.status !== BenchmarkAttemptStatus.QUEUED &&
      this.status !== BenchmarkAttemptStatus.RUNNING
    ) {
      throw new Error(
        `Cannot mark benchmark attempt as running from status ${this.status}`,
      );
    }

    this.status = BenchmarkAttemptStatus.RUNNING;
    this.startedAt = input?.at ?? new Date();
    this.errorMessage = null;

    const engineRunId = normalizeNullableShortText(input?.engineRunId, 255);
    if (engineRunId) {
      this.engineRunId = engineRunId;
    }
  }

  markCompleted(input: {
    score?: number | null;
    percentile?: number | null;
    passed?: boolean;
    telemetry?: BenchmarkAttemptTelemetry;
    feedback?: BenchmarkAttemptFeedback;
    result?: Record<string, unknown>;
    at?: Date;
  }): void {
    if (
      this.status !== BenchmarkAttemptStatus.RUNNING &&
      this.status !== BenchmarkAttemptStatus.COMPLETED
    ) {
      throw new Error(
        `Cannot mark benchmark attempt as completed from status ${this.status}`,
      );
    }

    this.status = BenchmarkAttemptStatus.COMPLETED;
    this.completedAt = input.at ?? new Date();
    this.startedAt = this.startedAt ?? this.completedAt;

    const score = normalizeFiniteNumber(input.score);
    if (score !== null) {
      this.score = score;
    }

    const percentile = normalizeFiniteNumber(input.percentile);
    if (percentile !== null) {
      this.percentile = Math.max(0, Math.min(100, percentile));
    }

    this.passed = input.passed === true;

    if (input.telemetry) {
      this.telemetryJson = normalizeTelemetry(input.telemetry);
    }

    if (input.feedback) {
      this.feedbackJson = normalizeFeedback(input.feedback);
    }

    if (input.result) {
      this.resultJson =
        input.result && typeof input.result === 'object' && !Array.isArray(input.result)
          ? { ...input.result }
          : {};
    }

    this.errorMessage = null;
  }

  markFailed(message: string, at: Date = new Date()): void {
    if (
      this.status !== BenchmarkAttemptStatus.QUEUED &&
      this.status !== BenchmarkAttemptStatus.RUNNING
    ) {
      throw new Error(
        `Cannot mark benchmark attempt as failed from status ${this.status}`,
      );
    }

    this.status = BenchmarkAttemptStatus.FAILED;
    this.completedAt = at;
    this.startedAt = this.startedAt ?? at;
    this.errorMessage =
      normalizeNullableShortText(message, 255) ?? 'Benchmark attempt failed';
  }

  markAbandoned(at: Date = new Date()): void {
    if (
      this.status !== BenchmarkAttemptStatus.QUEUED &&
      this.status !== BenchmarkAttemptStatus.RUNNING
    ) {
      throw new Error(
        `Cannot mark benchmark attempt as abandoned from status ${this.status}`,
      );
    }

    this.status = BenchmarkAttemptStatus.ABANDONED;
    this.completedAt = at;
  }

  invalidate(reason?: string): void {
    this.status = BenchmarkAttemptStatus.INVALIDATED;
    this.errorMessage =
      normalizeNullableShortText(reason, 255) ?? 'Benchmark attempt invalidated';
  }

  belongsToRun(benchmarkRunId: number): boolean {
    return this.benchmarkRunId === benchmarkRunId;
  }
}