// backend/src/entities/benchmark_attempt_run_link.entity.ts

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

export enum BenchmarkAttemptRunSource {
  PZO_ENGINE = 'pzo_engine',
  BACKEND = 'backend',
  HOST_OS = 'host_os',
  REPLAY = 'replay',
  EXTERNAL = 'external',
}

export enum BenchmarkAttemptRunLinkStatus {
  ACTIVE = 'active',
  ORPHANED = 'orphaned',
  INVALIDATED = 'invalidated',
}

export interface BenchmarkAttemptRunLinkMetadata {
  sourceScenarioKey?: string;
  replayVersion?: string;
  linkedBy?: string;
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

function normalizeMetadata(
  value: unknown,
): BenchmarkAttemptRunLinkMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as BenchmarkAttemptRunLinkMetadata;

  return {
    sourceScenarioKey:
      normalizeNullableShortText(input.sourceScenarioKey, 128) ?? undefined,
    replayVersion:
      normalizeNullableShortText(input.replayVersion, 64) ?? undefined,
    linkedBy: normalizeNullableShortText(input.linkedBy, 255) ?? undefined,
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

@Entity('benchmark_attempt_run_links')
@Index('idx_benchmark_attempt_run_links_benchmark_run_id', ['benchmarkRunId'])
@Index(
  'idx_benchmark_attempt_run_links_benchmark_attempt_id',
  ['benchmarkAttemptId'],
)
@Index('idx_benchmark_attempt_run_links_proof_stamp_id', ['proofStampId'])
@Index('idx_benchmark_attempt_run_links_run_source', ['runSource'])
@Index('idx_benchmark_attempt_run_links_external_run_id', ['externalRunId'])
@Index('idx_benchmark_attempt_run_links_status', ['status'])
@Index(
  'uq_benchmark_attempt_run_links_attempt_source_run',
  ['benchmarkAttemptId', 'runSource', 'externalRunId'],
  { unique: true },
)
export class BenchmarkAttemptRunLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'benchmark_run_id' })
  benchmarkRunId: number;

  @Column({ name: 'benchmark_attempt_id' })
  benchmarkAttemptId: number;

  @Column({
    type: 'uuid',
    name: 'proof_stamp_id',
    nullable: true,
  })
  proofStampId: string | null;

  @Column({
    type: 'enum',
    enum: BenchmarkAttemptRunSource,
    name: 'run_source',
    default: BenchmarkAttemptRunSource.PZO_ENGINE,
  })
  runSource: BenchmarkAttemptRunSource;

  @Column({ type: 'varchar', length: 255, name: 'external_run_id' })
  externalRunId: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'projection_run_id',
    nullable: true,
  })
  projectionRunId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'replay_key',
    nullable: true,
  })
  replayKey: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'link_reason',
    nullable: true,
  })
  linkReason: string | null;

  @Column({
    type: 'boolean',
    name: 'is_canonical',
    default: true,
  })
  isCanonical: boolean;

  @Column({
    type: 'enum',
    enum: BenchmarkAttemptRunLinkStatus,
    default: BenchmarkAttemptRunLinkStatus.ACTIVE,
  })
  status: BenchmarkAttemptRunLinkStatus;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: BenchmarkAttemptRunLinkMetadata;

  @Column({
    type: 'timestamptz',
    name: 'linked_at',
    default: () => 'NOW()',
  })
  linkedAt: Date;

  @Column({
    type: 'timestamptz',
    name: 'invalidated_at',
    nullable: true,
  })
  invalidatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => BenchmarkRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'benchmark_run_id' })
  benchmarkRun?: BenchmarkRun;

  @ManyToOne(() => BenchmarkAttempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'benchmark_attempt_id' })
  benchmarkAttempt?: BenchmarkAttempt;

  @ManyToOne(() => ProofStamp, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'proof_stamp_id', referencedColumnName: 'stampId' })
  proofStamp?: ProofStamp | null;

  normalizeExternalRunId(): string {
    return normalizeShortText(this.externalRunId, 255);
  }

  normalizeProjectionRunId(): string | null {
    return normalizeNullableShortText(this.projectionRunId, 255);
  }

  normalizeReplayKey(): string | null {
    return normalizeNullableShortText(this.replayKey, 255);
  }

  normalizeLinkReason(): string | null {
    return normalizeNullableShortText(this.linkReason, 255);
  }

  normalizeMetadata(): BenchmarkAttemptRunLinkMetadata {
    return normalizeMetadata(this.metadataJson);
  }

  setMetadata(metadata: BenchmarkAttemptRunLinkMetadata): void {
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

  isActive(): boolean {
    return this.status === BenchmarkAttemptRunLinkStatus.ACTIVE;
  }

  isInvalidated(): boolean {
    return this.status === BenchmarkAttemptRunLinkStatus.INVALIDATED;
  }

  isOrphaned(): boolean {
    return this.status === BenchmarkAttemptRunLinkStatus.ORPHANED;
  }

  markOrphaned(): void {
    this.status = BenchmarkAttemptRunLinkStatus.ORPHANED;
  }

  invalidate(at: Date = new Date()): void {
    this.status = BenchmarkAttemptRunLinkStatus.INVALIDATED;
    this.invalidatedAt = at;
    this.isCanonical = false;
  }

  restore(at: Date = new Date()): void {
    this.status = BenchmarkAttemptRunLinkStatus.ACTIVE;
    this.invalidatedAt = null;
    this.linkedAt = at;
  }

  setCanonical(isCanonical: boolean): void {
    this.isCanonical = isCanonical === true;
  }

  belongsToRun(benchmarkRunId: number): boolean {
    return this.benchmarkRunId === benchmarkRunId;
  }

  belongsToAttempt(benchmarkAttemptId: number): boolean {
    return this.benchmarkAttemptId === benchmarkAttemptId;
  }

  matchesExternalRunId(candidate: string): boolean {
    return this.normalizeExternalRunId() === normalizeShortText(candidate, 255);
  }
}