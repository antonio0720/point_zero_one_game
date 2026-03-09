// backend/src/entities/benchmark_output.entity.ts

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

import { BenchmarkAttempt } from './benchmark_attempt.entity';
import { BenchmarkRun } from './benchmark_run.entity';
import { ProofStamp } from './proof_stamp.entity';

export enum BenchmarkOutputType {
  SCORECARD = 'scorecard',
  SUMMARY = 'summary',
  TELEMETRY = 'telemetry',
  FEEDBACK = 'feedback',
  REPLAY = 'replay',
  CERTIFICATE = 'certificate',
  EXPORT = 'export',
  CUSTOM = 'custom',
}

export enum BenchmarkOutputFormat {
  JSON = 'json',
  MARKDOWN = 'markdown',
  HTML = 'html',
  TEXT = 'text',
  CSV = 'csv',
  PDF = 'pdf',
  URL = 'url',
}

export enum BenchmarkOutputStatus {
  PENDING = 'pending',
  READY = 'ready',
  FAILED = 'failed',
  ARCHIVED = 'archived',
  EXPIRED = 'expired',
}

export interface BenchmarkOutputPayload {
  score?: number;
  percentile?: number;
  passed?: boolean;
  summary?: string;
  sections?: string[];
  metrics?: Record<string, number>;
  [key: string]: unknown;
}

export interface BenchmarkOutputMetadata {
  source?: string;
  generator?: string;
  contentVersion?: string;
  locale?: string;
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

function normalizePayload(value: unknown): BenchmarkOutputPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkOutputPayload;
  const normalized: BenchmarkOutputPayload = {};

  const score = normalizeFiniteNumber(input.score);
  if (score !== null) {
    normalized.score = score;
  }

  const percentile = normalizeFiniteNumber(input.percentile);
  if (percentile !== null) {
    normalized.percentile = Math.max(0, Math.min(100, percentile));
  }

  if (typeof input.passed === 'boolean') {
    normalized.passed = input.passed;
  }

  const summary = normalizeNullableShortText(input.summary, 4000);
  if (summary) {
    normalized.summary = summary;
  }

  if (Array.isArray(input.sections)) {
    normalized.sections = [
      ...new Set(
        input.sections
          .map((entry) => normalizeShortText(entry, 255))
          .filter(Boolean),
      ),
    ];
  }

  if (
    input.metrics &&
    typeof input.metrics === 'object' &&
    !Array.isArray(input.metrics)
  ) {
    const nextMetrics: Record<string, number> = {};
    for (const [key, entry] of Object.entries(input.metrics)) {
      const numeric = normalizeFiniteNumber(entry);
      if (numeric !== null) {
        nextMetrics[normalizeShortText(key, 128)] = numeric;
      }
    }
    normalized.metrics = nextMetrics;
  }

  for (const [key, entry] of Object.entries(input)) {
    if (
      key === 'score' ||
      key === 'percentile' ||
      key === 'passed' ||
      key === 'summary' ||
      key === 'sections' ||
      key === 'metrics'
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

function normalizeMetadata(value: unknown): BenchmarkOutputMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkOutputMetadata;

  return {
    source: normalizeNullableShortText(input.source, 128) ?? undefined,
    generator: normalizeNullableShortText(input.generator, 128) ?? undefined,
    contentVersion:
      normalizeNullableShortText(input.contentVersion, 64) ?? undefined,
    locale: normalizeNullableShortText(input.locale, 32) ?? undefined,
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

@Entity('benchmark_outputs')
@Index('idx_benchmark_outputs_benchmark_run_id', ['benchmarkRunId'])
@Index('idx_benchmark_outputs_benchmark_attempt_id', ['benchmarkAttemptId'])
@Index('idx_benchmark_outputs_proof_stamp_id', ['proofStampId'])
@Index('idx_benchmark_outputs_output_type', ['outputType'])
@Index('idx_benchmark_outputs_status', ['status'])
@Index('idx_benchmark_outputs_generated_at', ['generatedAt'])
@Index('uq_benchmark_outputs_output_key', ['outputKey'], { unique: true })
export class BenchmarkOutput {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'benchmark_run_id' })
  benchmarkRunId: number;

  @Column({ name: 'benchmark_attempt_id', nullable: true })
  benchmarkAttemptId: number | null;

  @Column({
    type: 'uuid',
    name: 'proof_stamp_id',
    nullable: true,
  })
  proofStampId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'output_key' })
  outputKey: string;

  @Column({
    type: 'enum',
    enum: BenchmarkOutputType,
    name: 'output_type',
    default: BenchmarkOutputType.CUSTOM,
  })
  outputType: BenchmarkOutputType;

  @Column({
    type: 'enum',
    enum: BenchmarkOutputFormat,
    default: BenchmarkOutputFormat.JSON,
  })
  format: BenchmarkOutputFormat;

  @Column({
    type: 'enum',
    enum: BenchmarkOutputStatus,
    default: BenchmarkOutputStatus.PENDING,
  })
  status: BenchmarkOutputStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({
    type: 'jsonb',
    name: 'payload_json',
    default: () => "'{}'::jsonb",
  })
  payloadJson: BenchmarkOutputPayload;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: BenchmarkOutputMetadata;

  @Column({
    type: 'varchar',
    length: 1024,
    name: 'external_url',
    nullable: true,
  })
  externalUrl: string | null;

  @Column({
    type: 'varchar',
    length: 1024,
    name: 'storage_path',
    nullable: true,
  })
  storagePath: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'checksum_sha256',
    nullable: true,
  })
  checksumSha256: string | null;

  @Column({
    type: 'bigint',
    name: 'size_bytes',
    nullable: true,
  })
  sizeBytes: string | null;

  @Column({
    type: 'timestamptz',
    name: 'generated_at',
    nullable: true,
  })
  generatedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'archived_at',
    nullable: true,
  })
  archivedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'expires_at',
    nullable: true,
  })
  expiresAt: Date | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'error_message',
    nullable: true,
  })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => BenchmarkRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'benchmark_run_id' })
  benchmarkRun?: BenchmarkRun;

  @ManyToOne(() => BenchmarkAttempt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'benchmark_attempt_id' })
  benchmarkAttempt?: BenchmarkAttempt | null;

  @ManyToOne(() => ProofStamp, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'proof_stamp_id', referencedColumnName: 'stampId' })
  proofStamp?: ProofStamp | null;

  normalizeOutputKey(): string {
    return normalizeShortText(this.outputKey, 255);
  }

  normalizeTitle(): string {
    return normalizeShortText(this.title, 255);
  }

  normalizeSummary(): string | null {
    return normalizeNullableShortText(this.summary, 4000);
  }

  normalizeExternalUrl(): string | null {
    return normalizeNullableShortText(this.externalUrl, 1024);
  }

  normalizeStoragePath(): string | null {
    return normalizeNullableShortText(this.storagePath, 1024);
  }

  normalizeChecksumSha256(): string | null {
    return normalizeNullableShortText(this.checksumSha256, 64);
  }

  normalizeSizeBytes(): number | null {
    const parsed = Number.parseInt(String(this.sizeBytes ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  normalizePayload(): BenchmarkOutputPayload {
    return normalizePayload(this.payloadJson);
  }

  normalizeMetadata(): BenchmarkOutputMetadata {
    return normalizeMetadata(this.metadataJson);
  }

  setPayload(payload: BenchmarkOutputPayload): void {
    this.payloadJson = normalizePayload(payload);
  }

  setMetadata(metadata: BenchmarkOutputMetadata): void {
    this.metadataJson = normalizeMetadata(metadata);
  }

  setPayloadValue(key: string, value: unknown): void {
    const next = this.normalizePayload() as Record<string, unknown>;
    next[normalizeShortText(key, 128)] = value;
    this.payloadJson = next;
  }

  getPayloadValue<T = unknown>(key: string): T | undefined {
    const payload = this.normalizePayload() as Record<string, unknown>;
    return payload[key] as T | undefined;
  }

  isPending(): boolean {
    return this.status === BenchmarkOutputStatus.PENDING;
  }

  isReady(): boolean {
    return this.status === BenchmarkOutputStatus.READY;
  }

  isExpired(at: Date = new Date()): boolean {
    return this.expiresAt instanceof Date && this.expiresAt <= at;
  }

  publish(at: Date = new Date()): void {
    this.status = BenchmarkOutputStatus.READY;
    this.generatedAt = at;
    this.archivedAt = null;
    this.errorMessage = null;
  }

  fail(message: string, at: Date = new Date()): void {
    this.status = BenchmarkOutputStatus.FAILED;
    this.generatedAt = this.generatedAt ?? at;
    this.errorMessage =
      normalizeNullableShortText(message, 255) ?? 'Benchmark output failed';
  }

  archive(at: Date = new Date()): void {
    this.status = BenchmarkOutputStatus.ARCHIVED;
    this.archivedAt = at;
  }

  expire(at: Date = new Date()): void {
    this.status = BenchmarkOutputStatus.EXPIRED;
    this.expiresAt = at;
  }

  belongsToRun(benchmarkRunId: number): boolean {
    return this.benchmarkRunId === benchmarkRunId;
  }

  belongsToAttempt(benchmarkAttemptId: number): boolean {
    return this.benchmarkAttemptId === benchmarkAttemptId;
  }
}