import { createHash, randomUUID } from 'node:crypto';

export type CardLifecycleStatus = 'draft' | 'published' | 'retired';
export type CardDomain =
  | 'income'
  | 'debt'
  | 'asset'
  | 'liability'
  | 'macro'
  | 'chaos'
  | 'shield'
  | 'opportunity';
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'legendary';

export interface CardEffectDefinition {
  id: string;
  type: string;
  magnitude?: number;
  durationTicks?: number;
  payload?: Record<string, unknown>;
}

export interface CardAuthoringDraft {
  id: string;
  key: string;
  title: string;
  subtitle?: string | null;
  description: string;
  domain: CardDomain;
  rarity: CardRarity;
  energyCost: number;
  cooldownTicks: number;
  ladderLegal: boolean;
  proofSafe: boolean;
  practiceOnly?: boolean;
  tags: string[];
  telemetryTags: string[];
  effects: CardEffectDefinition[];
  rulesText?: string | null;
  flavorText?: string | null;
  authorId: string;
  rulesetVersion?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CardLintFinding {
  level: 'error' | 'warning';
  code:
    | 'invalid_schema'
    | 'duplicate_tag'
    | 'duplicate_effect_id'
    | 'proof_safety'
    | 'cooldown_missing'
    | 'telemetry_missing'
    | 'title_length'
    | 'description_length';
  message: string;
  path?: string;
}

export interface CardVersionRecord {
  cardId: string;
  version: number;
  status: CardLifecycleStatus;
  contentHash: string;
  publishedAt?: string | null;
  retiredAt?: string | null;
  actorId: string;
  card: CardAuthoringDraft;
  lint: CardLintFinding[];
}

export interface CardPublishResult {
  version: CardVersionRecord;
  lint: CardLintFinding[];
  published: boolean;
}

const DOMAIN_SET = new Set<CardDomain>([
  'income',
  'debt',
  'asset',
  'liability',
  'macro',
  'chaos',
  'shield',
  'opportunity',
]);

const RARITY_SET = new Set<CardRarity>([
  'starter',
  'common',
  'uncommon',
  'rare',
  'legendary',
]);

function nowIso(): string {
  return new Date().toISOString();
}

function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)) as T;
  }

  if (value && typeof value === 'object') {
    const sorted = Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
    return sorted as T;
  }

  return value;
}

function hashCard(card: CardAuthoringDraft): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(card)))
    .digest('hex');
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export class CardAuthoringApi {
  private readonly drafts = new Map<string, CardAuthoringDraft>();
  private readonly versions = new Map<string, CardVersionRecord[]>();

  public createDraft(
    input: Omit<CardAuthoringDraft, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<CardAuthoringDraft, 'id'>>,
  ): CardAuthoringDraft {
    const timestamp = nowIso();
    const draft: CardAuthoringDraft = {
      id: input.id ?? `card_${randomUUID()}`,
      key: input.key,
      title: input.title,
      subtitle: input.subtitle ?? null,
      description: input.description,
      domain: input.domain,
      rarity: input.rarity,
      energyCost: input.energyCost,
      cooldownTicks: input.cooldownTicks,
      ladderLegal: Boolean(input.ladderLegal),
      proofSafe: Boolean(input.proofSafe),
      practiceOnly: Boolean(input.practiceOnly),
      tags: uniqueStrings(input.tags ?? []),
      telemetryTags: uniqueStrings(input.telemetryTags ?? []),
      effects: [...(input.effects ?? [])],
      rulesText: input.rulesText ?? null,
      flavorText: input.flavorText ?? null,
      authorId: input.authorId,
      rulesetVersion: input.rulesetVersion ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: { ...(input.metadata ?? {}) },
    };

    this.assertValid(draft);
    this.drafts.set(draft.id, draft);
    return draft;
  }

  public updateDraft(
    cardId: string,
    patch: Partial<Omit<CardAuthoringDraft, 'id' | 'createdAt' | 'authorId'>>,
  ): CardAuthoringDraft {
    const existing = this.requireDraft(cardId);

    const updated: CardAuthoringDraft = {
      ...existing,
      ...patch,
      id: existing.id,
      authorId: existing.authorId,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
      tags: uniqueStrings(patch.tags ?? existing.tags),
      telemetryTags: uniqueStrings(patch.telemetryTags ?? existing.telemetryTags),
      effects: [...(patch.effects ?? existing.effects)],
      metadata: {
        ...(existing.metadata ?? {}),
        ...(patch.metadata ?? {}),
      },
    };

    this.assertValid(updated);
    this.drafts.set(cardId, updated);
    return updated;
  }

  public lintDraft(cardId: string): CardLintFinding[] {
    return this.runLint(this.requireDraft(cardId));
  }

  public publishDraft(cardId: string, actorId: string): CardPublishResult {
    const draft = this.requireDraft(cardId);
    const lint = this.runLint(draft);
    const hardErrors = lint.filter((item) => item.level === 'error');

    if (hardErrors.length > 0) {
      return {
        version: this.toVersionRecord(draft, actorId, 'draft', lint),
        lint,
        published: false,
      };
    }

    const versionHistory = this.versions.get(cardId) ?? [];
    const versionNumber = versionHistory.length + 1;

    const publishedVersion: CardVersionRecord = {
      cardId,
      version: versionNumber,
      status: 'published',
      contentHash: hashCard(draft),
      publishedAt: nowIso(),
      retiredAt: null,
      actorId,
      card: {
        ...draft,
        updatedAt: nowIso(),
      },
      lint,
    };

    versionHistory.push(publishedVersion);
    this.versions.set(cardId, versionHistory);

    return {
      version: publishedVersion,
      lint,
      published: true,
    };
  }

  public retirePublishedCard(cardId: string, actorId: string): CardVersionRecord {
    const versionHistory = this.versions.get(cardId) ?? [];
    if (versionHistory.length === 0) {
      throw new Error(`Cannot retire card without a published version: ${cardId}`);
    }

    const latest = versionHistory[versionHistory.length - 1];
    const retired: CardVersionRecord = {
      ...latest,
      status: 'retired',
      retiredAt: nowIso(),
      actorId,
    };

    versionHistory.push(retired);
    this.versions.set(cardId, versionHistory);

    const draft = this.requireDraft(cardId);
    this.drafts.set(cardId, {
      ...draft,
      practiceOnly: true,
      ladderLegal: false,
      updatedAt: nowIso(),
    });

    return retired;
  }

  public getDraft(cardId: string): CardAuthoringDraft | null {
    return this.drafts.get(cardId) ?? null;
  }

  public listDrafts(filter?: Partial<Pick<CardAuthoringDraft, 'domain' | 'rarity' | 'authorId'>>): CardAuthoringDraft[] {
    return [...this.drafts.values()].filter((draft) => {
      if (!filter) {
        return true;
      }
      if (filter.domain && draft.domain !== filter.domain) {
        return false;
      }
      if (filter.rarity && draft.rarity !== filter.rarity) {
        return false;
      }
      if (filter.authorId && draft.authorId !== filter.authorId) {
        return false;
      }
      return true;
    });
  }

  public listVersions(cardId: string): CardVersionRecord[] {
    return [...(this.versions.get(cardId) ?? [])];
  }

  public diffLatestVersion(cardId: string): {
    currentDraft: CardAuthoringDraft;
    latestVersion: CardVersionRecord | null;
    contentHashChanged: boolean;
  } {
    const currentDraft = this.requireDraft(cardId);
    const latestVersion = (this.versions.get(cardId) ?? []).slice(-1)[0] ?? null;

    return {
      currentDraft,
      latestVersion,
      contentHashChanged:
        latestVersion === null || latestVersion.contentHash !== hashCard(currentDraft),
    };
  }

  private assertValid(card: CardAuthoringDraft): void {
    const findings = this.getSchemaFindings(card).filter((item) => item.level === 'error');
    if (findings.length === 0) {
      return;
    }

    const message = findings.map((item) => `${item.path ?? 'card'}: ${item.message}`).join('; ');
    throw new Error(`Invalid card draft: ${message}`);
  }

  private runLint(card: CardAuthoringDraft): CardLintFinding[] {
    const findings: CardLintFinding[] = [...this.getSchemaFindings(card)];

    if (new Set(card.tags).size !== card.tags.length) {
      findings.push({
        level: 'warning',
        code: 'duplicate_tag',
        message: 'Duplicate tags will be collapsed at runtime.',
        path: 'tags',
      });
    }

    const effectIds = new Set<string>();
    for (const effect of card.effects) {
      if (effectIds.has(effect.id)) {
        findings.push({
          level: 'error',
          code: 'duplicate_effect_id',
          message: `Duplicate effect id: ${effect.id}`,
          path: 'effects',
        });
      }
      effectIds.add(effect.id);
    }

    if (card.ladderLegal && !card.proofSafe) {
      findings.push({
        level: 'error',
        code: 'proof_safety',
        message: 'Ladder-legal cards must be proof-safe.',
        path: 'proofSafe',
      });
    }

    if (card.cooldownTicks === 0 && card.rarity !== 'starter') {
      findings.push({
        level: 'warning',
        code: 'cooldown_missing',
        message: 'Non-starter cards with zero cooldown should be reviewed.',
        path: 'cooldownTicks',
      });
    }

    if (card.telemetryTags.length === 0) {
      findings.push({
        level: 'warning',
        code: 'telemetry_missing',
        message: 'Card should emit at least one telemetry tag.',
        path: 'telemetryTags',
      });
    }

    if (card.title.length > 60) {
      findings.push({
        level: 'warning',
        code: 'title_length',
        message: 'Card title is longer than recommended for compact UI surfaces.',
        path: 'title',
      });
    }

    if (card.description.length > 320) {
      findings.push({
        level: 'warning',
        code: 'description_length',
        message: 'Card description is longer than recommended for mobile card surfaces.',
        path: 'description',
      });
    }

    return findings;
  }

  private getSchemaFindings(card: CardAuthoringDraft): CardLintFinding[] {
    const findings: CardLintFinding[] = [];

    if (!card.id || card.id.trim().length < 5) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'id must be at least 5 characters',
        path: 'id',
      });
    }

    if (!/^[a-z0-9_:-]+$/.test(card.key)) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'key must match ^[a-z0-9_:-]+$',
        path: 'key',
      });
    }

    if (card.title.trim().length < 3 || card.title.trim().length > 80) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'title must be 3-80 characters',
        path: 'title',
      });
    }

    if (card.description.trim().length < 12 || card.description.trim().length > 600) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'description must be 12-600 characters',
        path: 'description',
      });
    }

    if (!DOMAIN_SET.has(card.domain)) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: `invalid domain: ${card.domain}`,
        path: 'domain',
      });
    }

    if (!RARITY_SET.has(card.rarity)) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: `invalid rarity: ${card.rarity}`,
        path: 'rarity',
      });
    }

    if (!Number.isInteger(card.energyCost) || card.energyCost < 0 || card.energyCost > 20) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'energyCost must be an integer between 0 and 20',
        path: 'energyCost',
      });
    }

    if (!Number.isInteger(card.cooldownTicks) || card.cooldownTicks < 0 || card.cooldownTicks > 500) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'cooldownTicks must be an integer between 0 and 500',
        path: 'cooldownTicks',
      });
    }

    if (!Array.isArray(card.tags)) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'tags must be an array',
        path: 'tags',
      });
    }

    if (!Array.isArray(card.telemetryTags)) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'telemetryTags must be an array',
        path: 'telemetryTags',
      });
    }

    if (!Array.isArray(card.effects) || card.effects.length === 0) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'effects must contain at least one effect',
        path: 'effects',
      });
    }

    for (const [index, effect] of card.effects.entries()) {
      if (!effect || typeof effect.id !== 'string' || effect.id.trim().length < 2) {
        findings.push({
          level: 'error',
          code: 'invalid_schema',
          message: 'effect id must be at least 2 characters',
          path: `effects.${index}.id`,
        });
      }

      if (!effect || typeof effect.type !== 'string' || effect.type.trim().length < 2) {
        findings.push({
          level: 'error',
          code: 'invalid_schema',
          message: 'effect type must be at least 2 characters',
          path: `effects.${index}.type`,
        });
      }

      if (
        effect.durationTicks !== undefined &&
        (!Number.isInteger(effect.durationTicks) || effect.durationTicks < 0)
      ) {
        findings.push({
          level: 'error',
          code: 'invalid_schema',
          message: 'effect durationTicks must be a non-negative integer',
          path: `effects.${index}.durationTicks`,
        });
      }
    }

    if (!card.authorId || card.authorId.trim().length < 2) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'authorId must be at least 2 characters',
        path: 'authorId',
      });
    }

    if (!isIsoDate(card.createdAt)) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'createdAt must be an ISO date',
        path: 'createdAt',
      });
    }

    if (!isIsoDate(card.updatedAt)) {
      findings.push({
        level: 'error',
        code: 'invalid_schema',
        message: 'updatedAt must be an ISO date',
        path: 'updatedAt',
      });
    }

    return findings;
  }

  private toVersionRecord(
    card: CardAuthoringDraft,
    actorId: string,
    status: CardLifecycleStatus,
    lint: CardLintFinding[],
  ): CardVersionRecord {
    return {
      cardId: card.id,
      version: (this.versions.get(card.id) ?? []).length,
      status,
      contentHash: hashCard(card),
      publishedAt: null,
      retiredAt: null,
      actorId,
      card,
      lint,
    };
  }

  private requireDraft(cardId: string): CardAuthoringDraft {
    const draft = this.drafts.get(cardId);
    if (!draft) {
      throw new Error(`Card draft not found: ${cardId}`);
    }
    return draft;
  }
}

export default CardAuthoringApi;
