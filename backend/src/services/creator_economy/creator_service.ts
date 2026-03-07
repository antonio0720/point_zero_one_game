/**
 * Point Zero One — Creator Economy Service
 * Path: backend/src/services/creator_economy/creator_service.ts
 *
 * Clean-room rebuild for quarantined module.
 *
 * Scope:
 * - creator profiles
 * - submission lifecycle
 * - budget balancing
 * - policy findings
 * - sandbox placement
 * - verified engagement revshare settlement
 */

export type CreatorTier = 'starter' | 'verified' | 'signature' | 'internal';
export type SubmissionState =
  | 'draft'
  | 'ingested'
  | 'linted'
  | 'policy-cleared'
  | 'verified'
  | 'sandboxed'
  | 'published'
  | 'rejected';
export type PolicySeverity = 'info' | 'warning' | 'blocker';
export type LedgerEntryKind = 'holdback' | 'eligible' | 'payout' | 'reversal';

export interface CreatorBudget {
  maxAssetsPerSubmission: number;
  maxTotalBytes: number;
  maxMinutes: number;
  maxTags: number;
  maxNoveltyScore: number;
}

export interface CreatorProfile {
  id: string;
  handle: string;
  displayName: string;
  tier: CreatorTier;
  budgets: CreatorBudget;
  trustScore: number;
  fraudRiskScore: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatorAsset {
  id: string;
  type: 'image' | 'audio' | 'video' | 'text' | 'config';
  bytes: number;
  durationSeconds: number;
  tags: string[];
  checksum: string;
}

export interface SubmissionBudgetSnapshot {
  assetCount: number;
  totalBytes: number;
  totalMinutes: number;
  tagCount: number;
  noveltyScore: number;
}

export interface PolicyFinding {
  id: string;
  severity: PolicySeverity;
  code: string;
  message: string;
  field: string | null;
}

export interface CreatorSubmission {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  state: SubmissionState;
  assets: CreatorAsset[];
  tags: string[];
  requestedAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  sandboxBucket: string | null;
  budgetSnapshot: SubmissionBudgetSnapshot;
  policyFindings: PolicyFinding[];
  receipts: CreatorReceipt[];
}

export interface CreatorReceipt {
  id: string;
  submissionId: string;
  kind: 'submission' | 'lint' | 'policy' | 'verification' | 'sandbox' | 'publish' | 'settlement';
  issuedAt: string;
  payload: Record<string, unknown>;
  integrityHash: string;
}

export interface RevenueShareRule {
  verifiedEngagementWeight: number;
  fraudPenaltyWeight: number;
  holdbackFloorBps: number;
  payoutCeilingBps: number;
}

export interface RevenueShareSettlementInput {
  submissionId: string;
  grossRevenueCents: number;
  verifiedEngagements: number;
  disputedEngagements?: number;
}

export interface RevenueShareLedgerEntry {
  id: string;
  submissionId: string;
  creatorId: string;
  kind: LedgerEntryKind;
  grossRevenueCents: number;
  netRevenueCents: number;
  payoutCents: number;
  holdbackCents: number;
  effectiveBps: number;
  computedAt: string;
  integrityHash: string;
}

export interface CreatorDashboard {
  creator: CreatorProfile;
  submissions: {
    total: number;
    published: number;
    rejected: number;
    sandboxed: number;
  };
  revenue: {
    grossRevenueCents: number;
    payoutCents: number;
    holdbackCents: number;
  };
  outstandingFindings: PolicyFinding[];
}

export interface CreatorServiceOptions {
  now?: () => Date;
  revshareRule?: Partial<RevenueShareRule>;
  idPrefix?: string;
}

const DEFAULT_BUDGETS: Record<CreatorTier, CreatorBudget> = {
  starter: {
    maxAssetsPerSubmission: 6,
    maxTotalBytes: 100 * 1024 * 1024,
    maxMinutes: 12,
    maxTags: 10,
    maxNoveltyScore: 80,
  },
  verified: {
    maxAssetsPerSubmission: 12,
    maxTotalBytes: 250 * 1024 * 1024,
    maxMinutes: 20,
    maxTags: 16,
    maxNoveltyScore: 90,
  },
  signature: {
    maxAssetsPerSubmission: 24,
    maxTotalBytes: 512 * 1024 * 1024,
    maxMinutes: 40,
    maxTags: 24,
    maxNoveltyScore: 95,
  },
  internal: {
    maxAssetsPerSubmission: 64,
    maxTotalBytes: 2 * 1024 * 1024 * 1024,
    maxMinutes: 120,
    maxTags: 64,
    maxNoveltyScore: 100,
  },
};

const DEFAULT_REVSHARE_RULE: RevenueShareRule = {
  verifiedEngagementWeight: 15,
  fraudPenaltyWeight: 10,
  holdbackFloorBps: 500,
  payoutCeilingBps: 7000,
};

export class CreatorService {
  private readonly now: () => Date;
  private readonly idPrefix: string;
  private readonly revshareRule: RevenueShareRule;
  private readonly creators = new Map<string, CreatorProfile>();
  private readonly submissions = new Map<string, CreatorSubmission>();
  private readonly settlements = new Map<string, RevenueShareLedgerEntry[]>();

  constructor(options: CreatorServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idPrefix = options.idPrefix ?? 'pzo';
    this.revshareRule = {
      ...DEFAULT_REVSHARE_RULE,
      ...(options.revshareRule ?? {}),
    };
  }

  registerCreator(input: {
    handle: string;
    displayName: string;
    tier?: CreatorTier;
    trustScore?: number;
    fraudRiskScore?: number;
    tags?: string[];
  }): CreatorProfile {
    const nowIso = this.now().toISOString();
    const tier = input.tier ?? 'starter';
    const handle = normalizeHandle(input.handle);
    const profile: CreatorProfile = {
      id: this.createId(`creator:${handle}`),
      handle,
      displayName: normalizeTitle(input.displayName),
      tier,
      budgets: deepClone(DEFAULT_BUDGETS[tier]),
      trustScore: clampNumber(input.trustScore ?? 60, 0, 100),
      fraudRiskScore: clampNumber(input.fraudRiskScore ?? 10, 0, 100),
      tags: uniqueStrings(input.tags ?? []),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.creators.set(profile.id, profile);
    return deepClone(profile);
  }

  updateCreatorBudgets(creatorId: string, patch: Partial<CreatorBudget>): CreatorProfile {
    const creator = this.requireCreator(creatorId);
    creator.budgets = {
      ...creator.budgets,
      ...sanitizeBudgetPatch(patch),
    };
    creator.updatedAt = this.now().toISOString();
    this.creators.set(creator.id, creator);
    return deepClone(creator);
  }

  createSubmission(input: {
    creatorId: string;
    title: string;
    description?: string;
    tags?: string[];
    assets?: Array<Partial<CreatorAsset>>;
  }): CreatorSubmission {
    const creator = this.requireCreator(input.creatorId);
    const nowIso = this.now().toISOString();
    const submissionId = this.createId(`submission:${creator.id}:${input.title}:${nowIso}`);
    const assets = (input.assets ?? []).map((asset, index) =>
      this.materializeAsset(submissionId, asset, index),
    );

    const submission: CreatorSubmission = {
      id: submissionId,
      creatorId: creator.id,
      title: normalizeTitle(input.title),
      description: String(input.description ?? '').trim(),
      state: 'draft',
      assets,
      tags: uniqueStrings(input.tags ?? []),
      requestedAt: nowIso,
      updatedAt: nowIso,
      verifiedAt: null,
      sandboxBucket: null,
      budgetSnapshot: computeBudgetSnapshot(assets, input.tags ?? []),
      policyFindings: [],
      receipts: [],
    };

    submission.receipts.push(this.issueReceipt(submission.id, 'submission', {
      creatorId: creator.id,
      assetCount: assets.length,
      requestedAt: nowIso,
    }));

    this.submissions.set(submission.id, submission);
    return deepClone(submission);
  }

  addAsset(submissionId: string, asset: Partial<CreatorAsset>): CreatorSubmission {
    const submission = this.requireSubmission(submissionId);
    const nextAsset = this.materializeAsset(submission.id, asset, submission.assets.length);
    submission.assets.push(nextAsset);
    submission.budgetSnapshot = computeBudgetSnapshot(submission.assets, submission.tags);
    submission.updatedAt = this.now().toISOString();
    this.submissions.set(submission.id, submission);
    return deepClone(submission);
  }

  lintSubmission(submissionId: string): CreatorSubmission {
    const submission = this.requireSubmission(submissionId);
    const creator = this.requireCreator(submission.creatorId);
    const findings: PolicyFinding[] = [];

    if (!submission.title.trim()) {
      findings.push(this.makeFinding('warning', 'TITLE_REQUIRED', 'Submission title is required.', 'title'));
    }

    if (submission.assets.length === 0) {
      findings.push(this.makeFinding('warning', 'ASSET_REQUIRED', 'At least one asset is required.', 'assets'));
    }

    applyBudgetFindings(findings, submission.budgetSnapshot, creator.budgets, this.makeFinding.bind(this));

    submission.state = 'linted';
    submission.policyFindings = mergeFindings(submission.policyFindings, findings);
    submission.updatedAt = this.now().toISOString();
    submission.receipts.push(
      this.issueReceipt(submission.id, 'lint', {
        findings: serializeFindings(findings),
        budgetSnapshot: submission.budgetSnapshot,
      }),
    );

    this.submissions.set(submission.id, submission);
    return deepClone(submission);
  }

  policyScan(submissionId: string): CreatorSubmission {
    const submission = this.requireSubmission(submissionId);
    const findings = [...submission.policyFindings];

    const description = `${submission.title} ${submission.description}`.toLowerCase();
    const sensitiveTerms = ['password', 'credential', 'token', 'exploit', 'doxx', 'malware'];

    for (const term of sensitiveTerms) {
      if (description.includes(term)) {
        findings.push(
          this.makeFinding(
            'blocker',
            `TERM_${term.toUpperCase()}`,
            `Submission contains sensitive term: ${term}.`,
            'description',
          ),
        );
      }
    }

    if (submission.tags.some((tag) => tag.startsWith('nsfw'))) {
      findings.push(
        this.makeFinding('warning', 'NSFW_TAG', 'Submission includes a restricted classification tag.', 'tags'),
      );
    }

    submission.state = 'policy-cleared';
    submission.policyFindings = mergeFindings(findings, []);
    submission.updatedAt = this.now().toISOString();
    submission.receipts.push(
      this.issueReceipt(submission.id, 'policy', {
        blockerCount: submission.policyFindings.filter((finding) => finding.severity === 'blocker').length,
        warningCount: submission.policyFindings.filter((finding) => finding.severity === 'warning').length,
      }),
    );

    this.submissions.set(submission.id, submission);
    return deepClone(submission);
  }

  verifySubmission(submissionId: string): CreatorSubmission {
    const submission = this.requireSubmission(submissionId);
    const creator = this.requireCreator(submission.creatorId);

    const blockers = submission.policyFindings.filter((finding) => finding.severity === 'blocker');
    if (blockers.length > 0) {
      submission.state = 'rejected';
      submission.updatedAt = this.now().toISOString();
      submission.receipts.push(
        this.issueReceipt(submission.id, 'verification', {
          accepted: false,
          blockerCodes: blockers.map((entry) => entry.code),
        }),
      );
      this.submissions.set(submission.id, submission);
      return deepClone(submission);
    }

    const healthScore = computeHealthScore(creator, submission);
    submission.verifiedAt = this.now().toISOString();
    submission.state = healthScore >= 55 ? 'verified' : 'rejected';
    submission.updatedAt = submission.verifiedAt;
    submission.receipts.push(
      this.issueReceipt(submission.id, 'verification', {
        accepted: submission.state === 'verified',
        healthScore,
        trustScore: creator.trustScore,
        fraudRiskScore: creator.fraudRiskScore,
      }),
    );

    this.submissions.set(submission.id, submission);
    return deepClone(submission);
  }

  placeInSandbox(submissionId: string): CreatorSubmission {
    const submission = this.requireSubmission(submissionId);
    const creator = this.requireCreator(submission.creatorId);

    if (submission.state !== 'verified') {
      throw new Error('Only verified submissions can be sandboxed.');
    }

    submission.sandboxBucket = pickSandboxBucket(creator, submission);
    submission.state = 'sandboxed';
    submission.updatedAt = this.now().toISOString();
    submission.receipts.push(
      this.issueReceipt(submission.id, 'sandbox', {
        sandboxBucket: submission.sandboxBucket,
      }),
    );

    this.submissions.set(submission.id, submission);
    return deepClone(submission);
  }

  publishSubmission(submissionId: string): CreatorSubmission {
    const submission = this.requireSubmission(submissionId);

    if (!['verified', 'sandboxed'].includes(submission.state)) {
      throw new Error('Submission must be verified or sandboxed before publish.');
    }

    submission.state = 'published';
    submission.updatedAt = this.now().toISOString();
    submission.receipts.push(
      this.issueReceipt(submission.id, 'publish', {
        publishedAt: submission.updatedAt,
      }),
    );

    this.submissions.set(submission.id, submission);
    return deepClone(submission);
  }

  settleRevenueShare(input: RevenueShareSettlementInput): RevenueShareLedgerEntry {
    const submission = this.requireSubmission(input.submissionId);
    const creator = this.requireCreator(submission.creatorId);

    const grossRevenueCents = clampInteger(input.grossRevenueCents, 0, Number.MAX_SAFE_INTEGER);
    const verifiedEngagements = clampInteger(input.verifiedEngagements, 0, 100_000_000);
    const disputedEngagements = clampInteger(input.disputedEngagements ?? 0, 0, verifiedEngagements);
    const netVerifiedEngagements = Math.max(0, verifiedEngagements - disputedEngagements);

    const trustLiftBps = Math.round(creator.trustScore * this.revshareRule.verifiedEngagementWeight);
    const fraudPenaltyBps = Math.round(creator.fraudRiskScore * this.revshareRule.fraudPenaltyWeight);
    const rawBps = 1000 + trustLiftBps + Math.round(netVerifiedEngagements / 10) - fraudPenaltyBps;
    const effectiveBps = clampInteger(
      rawBps,
      this.revshareRule.holdbackFloorBps,
      this.revshareRule.payoutCeilingBps,
    );

    const payoutCents = Math.floor((grossRevenueCents * effectiveBps) / 10_000);
    const holdbackCents = Math.max(0, grossRevenueCents - payoutCents);
    const nowIso = this.now().toISOString();

    const entry: RevenueShareLedgerEntry = {
      id: this.createId(`settlement:${submission.id}:${nowIso}`),
      submissionId: submission.id,
      creatorId: creator.id,
      kind: submission.state === 'published' ? 'eligible' : 'holdback',
      grossRevenueCents,
      netRevenueCents: grossRevenueCents - holdbackCents,
      payoutCents,
      holdbackCents,
      effectiveBps,
      computedAt: nowIso,
      integrityHash: createIntegrityHash({
        submissionId: submission.id,
        creatorId: creator.id,
        grossRevenueCents,
        payoutCents,
        holdbackCents,
        effectiveBps,
        computedAt: nowIso,
      }),
    };

    const entries = this.settlements.get(submission.id) ?? [];
    entries.push(entry);
    this.settlements.set(submission.id, entries);

    submission.receipts.push(
      this.issueReceipt(submission.id, 'settlement', {
        ledgerEntryId: entry.id,
        payoutCents: entry.payoutCents,
        holdbackCents: entry.holdbackCents,
        effectiveBps: entry.effectiveBps,
      }),
    );
    submission.updatedAt = nowIso;
    this.submissions.set(submission.id, submission);

    return deepClone(entry);
  }

  buildDashboard(creatorId: string): CreatorDashboard {
    const creator = this.requireCreator(creatorId);
    const submissions = [...this.submissions.values()].filter((entry) => entry.creatorId === creator.id);
    const settlements = submissions.flatMap((entry) => this.settlements.get(entry.id) ?? []);

    return {
      creator: deepClone(creator),
      submissions: {
        total: submissions.length,
        published: submissions.filter((entry) => entry.state === 'published').length,
        rejected: submissions.filter((entry) => entry.state === 'rejected').length,
        sandboxed: submissions.filter((entry) => entry.state === 'sandboxed').length,
      },
      revenue: {
        grossRevenueCents: settlements.reduce((sum, entry) => sum + entry.grossRevenueCents, 0),
        payoutCents: settlements.reduce((sum, entry) => sum + entry.payoutCents, 0),
        holdbackCents: settlements.reduce((sum, entry) => sum + entry.holdbackCents, 0),
      },
      outstandingFindings: submissions
        .flatMap((entry) => entry.policyFindings)
        .filter((finding) => finding.severity !== 'info'),
    };
  }

  listCreators(): CreatorProfile[] {
    return [...this.creators.values()].map(deepClone);
  }

  listSubmissions(creatorId?: string): CreatorSubmission[] {
    return [...this.submissions.values()]
      .filter((entry) => !creatorId || entry.creatorId === creatorId)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
      .map(deepClone);
  }

  private requireCreator(creatorId: string): CreatorProfile {
    const creator = this.creators.get(creatorId);
    if (!creator) {
      throw new Error(`Creator ${creatorId} not found.`);
    }
    return creator;
  }

  private requireSubmission(submissionId: string): CreatorSubmission {
    const submission = this.submissions.get(submissionId);
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found.`);
    }
    return submission;
  }

  private materializeAsset(
    submissionId: string,
    asset: Partial<CreatorAsset>,
    index: number,
  ): CreatorAsset {
    const type = (asset.type ?? 'config') as CreatorAsset['type'];
    const bytes = clampInteger(asset.bytes ?? 0, 0, Number.MAX_SAFE_INTEGER);
    const durationSeconds = clampInteger(asset.durationSeconds ?? 0, 0, 24 * 60 * 60);
    const tags = uniqueStrings(asset.tags ?? []);
    const checksumSeed = JSON.stringify({ type, bytes, durationSeconds, tags, submissionId, index });

    return {
      id: this.createId(`asset:${submissionId}:${index}`),
      type,
      bytes,
      durationSeconds,
      tags,
      checksum: asset.checksum?.trim() || createIntegrityHash(checksumSeed),
    };
  }

  private issueReceipt(
    submissionId: string,
    kind: CreatorReceipt['kind'],
    payload: Record<string, unknown>,
  ): CreatorReceipt {
    const issuedAt = this.now().toISOString();
    return {
      id: this.createId(`receipt:${submissionId}:${kind}:${issuedAt}`),
      submissionId,
      kind,
      issuedAt,
      payload,
      integrityHash: createIntegrityHash({ submissionId, kind, issuedAt, payload }),
    };
  }

  private makeFinding(
    severity: PolicySeverity,
    code: string,
    message: string,
    field: string | null,
  ): PolicyFinding {
    return {
      id: this.createId(`finding:${severity}:${code}:${field ?? 'none'}`),
      severity,
      code,
      message,
      field,
    };
  }

  private createId(seed: string): string {
    return `${this.idPrefix}_${createIntegrityHash(seed).slice(0, 18)}`;
  }
}

export function computeBudgetSnapshot(
  assets: CreatorAsset[],
  tags: string[],
): SubmissionBudgetSnapshot {
  const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const totalMinutes = assets.reduce((sum, asset) => sum + asset.durationSeconds, 0) / 60;
  const tagCount = uniqueStrings([...tags, ...assets.flatMap((asset) => asset.tags)]).length;
  const entropyBase = assets.reduce((sum, asset) => sum + asset.checksum.length, 0) + tagCount * 11;

  return {
    assetCount: assets.length,
    totalBytes,
    totalMinutes: round(totalMinutes, 4),
    tagCount,
    noveltyScore: clampNumber((entropyBase % 101) + assets.length * 3, 0, 100),
  };
}

function applyBudgetFindings(
  findings: PolicyFinding[],
  snapshot: SubmissionBudgetSnapshot,
  budgets: CreatorBudget,
  makeFinding: (severity: PolicySeverity, code: string, message: string, field: string | null) => PolicyFinding,
): void {
  if (snapshot.assetCount > budgets.maxAssetsPerSubmission) {
    findings.push(
      makeFinding(
        'blocker',
        'BUDGET_ASSET_COUNT',
        `Asset count ${snapshot.assetCount} exceeds budget ${budgets.maxAssetsPerSubmission}.`,
        'assets',
      ),
    );
  }

  if (snapshot.totalBytes > budgets.maxTotalBytes) {
    findings.push(
      makeFinding(
        'blocker',
        'BUDGET_BYTES',
        `Payload bytes ${snapshot.totalBytes} exceed budget ${budgets.maxTotalBytes}.`,
        'assets',
      ),
    );
  }

  if (snapshot.totalMinutes > budgets.maxMinutes) {
    findings.push(
      makeFinding(
        'warning',
        'BUDGET_DURATION',
        `Duration ${snapshot.totalMinutes} minutes exceeds budget ${budgets.maxMinutes}.`,
        'assets',
      ),
    );
  }

  if (snapshot.tagCount > budgets.maxTags) {
    findings.push(
      makeFinding(
        'warning',
        'BUDGET_TAGS',
        `Tag count ${snapshot.tagCount} exceeds budget ${budgets.maxTags}.`,
        'tags',
      ),
    );
  }

  if (snapshot.noveltyScore > budgets.maxNoveltyScore) {
    findings.push(
      makeFinding(
        'warning',
        'BUDGET_NOVELTY',
        `Novelty score ${snapshot.noveltyScore} exceeds budget ${budgets.maxNoveltyScore}.`,
        'assets',
      ),
    );
  }
}

function mergeFindings(existing: PolicyFinding[], next: PolicyFinding[]): PolicyFinding[] {
  const seen = new Set<string>();
  const merged: PolicyFinding[] = [];
  for (const finding of [...existing, ...next]) {
    const key = `${finding.severity}:${finding.code}:${finding.field ?? 'none'}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(finding);
    }
  }
  return merged;
}

function serializeFindings(findings: PolicyFinding[]): Array<Record<string, unknown>> {
  return findings.map((finding) => ({
    severity: finding.severity,
    code: finding.code,
    message: finding.message,
    field: finding.field,
  }));
}

function computeHealthScore(creator: CreatorProfile, submission: CreatorSubmission): number {
  const blockerPenalty = submission.policyFindings.filter((finding) => finding.severity === 'blocker').length * 40;
  const warningPenalty = submission.policyFindings.filter((finding) => finding.severity === 'warning').length * 8;
  const trustLift = creator.trustScore * 0.7;
  const fraudPenalty = creator.fraudRiskScore * 0.9;
  const noveltyPenalty = Math.max(0, submission.budgetSnapshot.noveltyScore - creator.budgets.maxNoveltyScore);
  return clampNumber(Math.round(50 + trustLift - fraudPenalty - blockerPenalty - warningPenalty - noveltyPenalty), 0, 100);
}

function pickSandboxBucket(creator: CreatorProfile, submission: CreatorSubmission): string {
  const trustBand = creator.trustScore >= 85 ? 'trusted' : creator.trustScore >= 65 ? 'standard' : 'guarded';
  const contentBand = submission.budgetSnapshot.totalMinutes > 15 ? 'longform' : 'shortform';
  return `${trustBand}-${contentBand}`;
}

function sanitizeBudgetPatch(patch: Partial<CreatorBudget>): Partial<CreatorBudget> {
  const next: Partial<CreatorBudget> = {};
  if (patch.maxAssetsPerSubmission !== undefined) {
    next.maxAssetsPerSubmission = clampInteger(patch.maxAssetsPerSubmission, 1, 10_000);
  }
  if (patch.maxTotalBytes !== undefined) {
    next.maxTotalBytes = clampInteger(patch.maxTotalBytes, 1, Number.MAX_SAFE_INTEGER);
  }
  if (patch.maxMinutes !== undefined) {
    next.maxMinutes = clampNumber(patch.maxMinutes, 1, 100_000);
  }
  if (patch.maxTags !== undefined) {
    next.maxTags = clampInteger(patch.maxTags, 1, 10_000);
  }
  if (patch.maxNoveltyScore !== undefined) {
    next.maxNoveltyScore = clampNumber(patch.maxNoveltyScore, 0, 100);
  }
  return next;
}

function normalizeHandle(input: string): string {
  const handle = String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!handle) {
    throw new Error('Creator handle is required.');
  }
  return handle.slice(0, 64);
}

function normalizeTitle(input: string): string {
  return String(input).trim().replace(/\s+/g, ' ').slice(0, 160) || 'Untitled';
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function clampInteger(value: number, min: number, max: number): number {
  const safe = Math.trunc(Number(value));
  if (!Number.isFinite(safe)) {
    return min;
  }
  return Math.max(min, Math.min(max, safe));
}

function clampNumber(value: number, min: number, max: number): number {
  const safe = Number(value);
  if (!Number.isFinite(safe)) {
    return min;
  }
  return Math.max(min, Math.min(max, safe));
}

function round(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createIntegrityHash(payload: unknown): string {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
