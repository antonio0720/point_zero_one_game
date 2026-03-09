// backend/src/entities/runbook_link.entity.ts

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

import { Account } from '../accounts/account.entity';
import { AlertRuleType } from './alert_rule.entity';

export enum RunbookLinkStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export interface RunbookLinkMetadata {
  owner?: string;
  service?: string;
  team?: string;
  tags?: string[];
  version?: string;
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

function normalizeMetadata(value: unknown): RunbookLinkMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as RunbookLinkMetadata;

  return {
    owner: normalizeNullableShortText(input.owner, 128) ?? undefined,
    service: normalizeNullableShortText(input.service, 128) ?? undefined,
    team: normalizeNullableShortText(input.team, 128) ?? undefined,
    version: normalizeNullableShortText(input.version, 64) ?? undefined,
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((value) => normalizeShortText(value, 64)).filter(Boolean))]
      : undefined,
  };
}

@Entity('runbook_links')
@Index('idx_runbook_links_account_id', ['accountId'])
@Index('idx_runbook_links_slug', ['slug'])
@Index('idx_runbook_links_status', ['status'])
@Index('idx_runbook_links_target_rule_type', ['targetRuleType'])
@Index('uq_runbook_links_account_slug', ['accountId', 'slug'], {
  unique: true,
})
export class RunbookLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ type: 'varchar', length: 128 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  url: string | null;

  @Column({
    type: 'text',
    name: 'content_markdown',
    nullable: true,
  })
  contentMarkdown: string | null;

  @Column({
    type: 'enum',
    enum: RunbookLinkStatus,
    default: RunbookLinkStatus.ACTIVE,
  })
  status: RunbookLinkStatus;

  @Column({
    type: 'enum',
    enum: AlertRuleType,
    name: 'target_rule_type',
    nullable: true,
  })
  targetRuleType: AlertRuleType | null;

  @Column({
    type: 'boolean',
    name: 'is_default_for_rule_type',
    default: false,
  })
  isDefaultForRuleType: boolean;

  @Column({
    type: 'jsonb',
    name: 'metadata_json',
    default: () => "'{}'::jsonb",
  })
  metadataJson: RunbookLinkMetadata;

  @Column({
    type: 'timestamptz',
    name: 'published_at',
    nullable: true,
  })
  publishedAt: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'archived_at',
    nullable: true,
  })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  normalizeSlug(): string {
    const raw = normalizeShortText(this.slug, 128).toLowerCase();
    return raw.replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
  }

  normalizeTitle(): string {
    return normalizeShortText(this.title, 255);
  }

  normalizeDescription(): string | null {
    const value = String(this.description ?? '').trim();
    return value.length > 0 ? value : null;
  }

  normalizeUrl(): string | null {
    return normalizeNullableShortText(this.url, 1024);
  }

  normalizeContentMarkdown(): string | null {
    const value = String(this.contentMarkdown ?? '').trim();
    return value.length > 0 ? value : null;
  }

  normalizeMetadata(): RunbookLinkMetadata {
    return normalizeMetadata(this.metadataJson);
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

  hasExternalUrl(): boolean {
    return this.normalizeUrl() !== null;
  }

  hasInlineContent(): boolean {
    return this.normalizeContentMarkdown() !== null;
  }

  isActive(): boolean {
    return this.status === RunbookLinkStatus.ACTIVE;
  }

  isArchived(): boolean {
    return this.status === RunbookLinkStatus.ARCHIVED;
  }

  matchesRuleType(ruleType: AlertRuleType | null | undefined): boolean {
    if (!ruleType) {
      return false;
    }

    return this.targetRuleType === ruleType;
  }

  publish(at: Date = new Date()): void {
    this.status = RunbookLinkStatus.ACTIVE;
    this.publishedAt = at;
    this.archivedAt = null;
  }

  archive(at: Date = new Date()): void {
    this.status = RunbookLinkStatus.ARCHIVED;
    this.archivedAt = at;
  }

  setTags(tags: string[]): void {
    const metadata = this.normalizeMetadata();
    metadata.tags = [
      ...new Set(tags.map((value) => normalizeShortText(value, 64)).filter(Boolean)),
    ];
    this.metadataJson = metadata;
  }

  getTags(): string[] {
    const metadata = this.normalizeMetadata();
    return Array.isArray(metadata.tags) ? metadata.tags : [];
  }

  belongsToAccount(accountId: number): boolean {
    return this.accountId === accountId;
  }
}