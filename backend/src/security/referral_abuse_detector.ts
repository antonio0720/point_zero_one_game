/**
 * Referral Abuse Detector for Point Zero One Digital's financial roguelike game
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/referral_abuse_detector.ts
 */

import { createHash } from 'node:crypto';
import type {
  ReferralAttribution,
  ReferralConversion,
} from '../services/referrals';
import {
  ReceiptLedger,
  type ReceiptBatch,
  type ReceiptLedgerEntry,
} from './receipt_ledger_integrity';
import {
  createInternalQuarantineMessage,
  type InternalQuarantineMessage,
} from './quarantine_messaging';

export type ReferralAbuseSignal =
  | 'REFERRAL_VELOCITY_BREACH'
  | 'QUALIFIED_SPIKE'
  | 'DEVICE_CLUSTERING'
  | 'PAYMENT_CLUSTERING'
  | 'HOUSEHOLD_CLUSTERING'
  | 'REPEAT_REFEREE'
  | 'HIGH_REJECTION_RATE'
  | 'CODE_BURN_PATTERN';

export type ReferralAbuseDisposition = 'ALLOW' | 'REVIEW' | 'REJECT';

export interface ReferralAbuseDetectorOptions {
  readonly referralWindowMs: number;
  readonly qualifiedWindowMs: number;
  readonly maxReferralsPerWindow: number;
  readonly maxQualifiedPerWindow: number;
  readonly maxFingerprintCollisions: number;
  readonly maxCodeUsesPerWindow: number;
  readonly minSampleForRejectionRate: number;
  readonly maxRejectionRate: number;
  readonly reviewThreshold: number;
  readonly rejectThreshold: number;
}

export interface ReferralAbuseDecision {
  readonly allowed: boolean;
  readonly disposition: ReferralAbuseDisposition;
  readonly riskScore: number;
  readonly signals: readonly ReferralAbuseSignal[];
  readonly rejectionReason: string | null;
  readonly quarantineMessage: InternalQuarantineMessage | null;
}

export interface ThrottleNewReferralInput {
  readonly attribution: ReferralAttribution;
  readonly existingAttributions: readonly ReferralAttribution[];
  readonly existingConversions?: readonly ReferralConversion[];
  readonly receiptLedger?: ReceiptLedger | null;
  readonly quarantineSecret?: string | null;
  readonly nowMs?: number;
  readonly options?: Partial<ReferralAbuseDetectorOptions>;
}

export interface ThrottleNewReferralResult {
  readonly attribution: ReferralAttribution;
  readonly decision: ReferralAbuseDecision;
  readonly receipt: ReceiptLedgerEntry | null;
}

export interface InvalidateSuspiciousCompletionsInput {
  readonly conversions: readonly ReferralConversion[];
  readonly attributions: readonly ReferralAttribution[];
  readonly nowMs?: number;
  readonly options?: Partial<ReferralAbuseDetectorOptions>;
}

export interface LogReceiptInput {
  readonly referral: ReferralAttribution | ReferralConversion;
  readonly ledger: ReceiptLedger;
  readonly eventName?: string;
  readonly decision?: ReferralAbuseDecision | null;
  readonly secret?: string | null;
  readonly issuedAtMs?: number;
}

export interface LoggedReferralReceipt {
  readonly entry: ReceiptLedgerEntry;
  readonly batch: ReceiptBatch | null;
}

const DEFAULT_OPTIONS: ReferralAbuseDetectorOptions = {
  referralWindowMs: 60 * 60 * 1000,
  qualifiedWindowMs: 24 * 60 * 60 * 1000,
  maxReferralsPerWindow: 10,
  maxQualifiedPerWindow: 25,
  maxFingerprintCollisions: 1,
  maxCodeUsesPerWindow: 20,
  minSampleForRejectionRate: 5,
  maxRejectionRate: 0.60,
  reviewThreshold: 35,
  rejectThreshold: 60,
};

const SIGNAL_WEIGHTS: Readonly<Record<ReferralAbuseSignal, number>> = {
  REFERRAL_VELOCITY_BREACH: 25,
  QUALIFIED_SPIKE: 25,
  DEVICE_CLUSTERING: 30,
  PAYMENT_CLUSTERING: 40,
  HOUSEHOLD_CLUSTERING: 25,
  REPEAT_REFEREE: 40,
  HIGH_REJECTION_RATE: 15,
  CODE_BURN_PATTERN: 20,
};

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeUserId(userId: string | number): string {
  return String(userId).normalize('NFKC').trim();
}

function sameNonEmpty(lhs?: string | null, rhs?: string | null): boolean {
  return typeof lhs === 'string' && lhs.length > 0 && lhs === rhs;
}

function hashFingerprint(value?: string | null): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return sha256(value).slice(0, 16);
}

function clampRiskScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) {
    return 0;
  }

  return Math.min(100, Math.trunc(score));
}

function mergeOptions(
  options?: Partial<ReferralAbuseDetectorOptions>,
): ReferralAbuseDetectorOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...(options ?? {}),
  };
}

function countRecentAttributionsForReferrer(
  referrerUserId: string,
  attributions: readonly ReferralAttribution[],
  nowMs: number,
  windowMs: number,
): number {
  const windowStart = nowMs - windowMs;

  return attributions.filter(
    (entry) =>
      entry.referrerUserId === referrerUserId &&
      entry.signupAtMs >= windowStart &&
      entry.signupAtMs <= nowMs &&
      entry.status !== 'REJECTED',
  ).length;
}

function countRecentQualifiedConversionsForReferrer(
  referrerUserId: string,
  attributions: readonly ReferralAttribution[],
  conversions: readonly ReferralConversion[],
  nowMs: number,
  windowMs: number,
): number {
  const attributionById = new Map(
    attributions.map((entry) => [entry.attributionId, entry] as const),
  );
  const windowStart = nowMs - windowMs;

  return conversions.filter((conversion) => {
    if (conversion.status !== 'QUALIFIED') {
      return false;
    }

    if (
      conversion.qualifiedAtMs < windowStart ||
      conversion.qualifiedAtMs > nowMs
    ) {
      return false;
    }

    const attribution = attributionById.get(conversion.attributionId);
    return attribution?.referrerUserId === referrerUserId;
  }).length;
}

function countFingerprintCollisions(
  candidate: ReferralAttribution,
  attributions: readonly ReferralAttribution[],
): {
  readonly device: number;
  readonly payment: number;
  readonly household: number;
} {
  let device = 0;
  let payment = 0;
  let household = 0;

  for (const existing of attributions) {
    if (existing.referrerUserId !== candidate.referrerUserId) {
      continue;
    }

    if (
      sameNonEmpty(existing.deviceFingerprint, candidate.deviceFingerprint)
    ) {
      device += 1;
    }

    if (
      sameNonEmpty(existing.paymentFingerprint, candidate.paymentFingerprint)
    ) {
      payment += 1;
    }

    if (
      sameNonEmpty(existing.householdFingerprint, candidate.householdFingerprint)
    ) {
      household += 1;
    }
  }

  return { device, payment, household };
}

function countRecentCodeUses(
  candidate: ReferralAttribution,
  attributions: readonly ReferralAttribution[],
  nowMs: number,
  windowMs: number,
): number {
  const windowStart = nowMs - windowMs;

  return attributions.filter(
    (entry) =>
      entry.codeId === candidate.codeId &&
      entry.signupAtMs >= windowStart &&
      entry.signupAtMs <= nowMs &&
      entry.status !== 'REJECTED',
  ).length;
}

function calculateRejectionRate(
  referrerUserId: string,
  attributions: readonly ReferralAttribution[],
  nowMs: number,
  windowMs: number,
): {
  readonly total: number;
  readonly rejected: number;
  readonly rate: number;
} {
  const windowStart = nowMs - windowMs;
  const sample = attributions.filter(
    (entry) =>
      entry.referrerUserId === referrerUserId &&
      entry.signupAtMs >= windowStart &&
      entry.signupAtMs <= nowMs,
  );

  const rejected = sample.filter((entry) => entry.status === 'REJECTED').length;
  const total = sample.length;

  return {
    total,
    rejected,
    rate: total > 0 ? rejected / total : 0,
  };
}

function buildQuarantineMessage(
  attribution: ReferralAttribution,
  signals: readonly ReferralAbuseSignal[],
  riskScore: number,
  disposition: ReferralAbuseDisposition,
  secret?: string | null,
): InternalQuarantineMessage | null {
  if (signals.length === 0 || disposition === 'ALLOW') {
    return null;
  }

  return createInternalQuarantineMessage(
    new Date(attribution.signupAtMs),
    `Referral abuse detector flagged attribution ${attribution.attributionId}.`,
    signals[0]!,
    {
      severity: disposition === 'REJECT' ? 'CRITICAL' : 'WARN',
      disposition:
        disposition === 'REJECT' ? 'QUARANTINED' : 'REVIEW_REQUIRED',
      correlationId: attribution.attributionId,
      details: {
        attributionId: attribution.attributionId,
        referrerUserId: attribution.referrerUserId,
        refereeUserId: attribution.refereeUserId,
        codeId: attribution.codeId,
        riskScore,
        signals,
        deviceFingerprintHash: hashFingerprint(attribution.deviceFingerprint),
        paymentFingerprintHash: hashFingerprint(attribution.paymentFingerprint),
        householdFingerprintHash: hashFingerprint(
          attribution.householdFingerprint,
        ),
      },
      secret: secret ?? null,
    },
  );
}

function toRejectionReason(signal: ReferralAbuseSignal): string {
  return signal;
}

export class ReferralAbuseDetector {
  private readonly options: ReferralAbuseDetectorOptions;

  public constructor(options?: Partial<ReferralAbuseDetectorOptions>) {
    this.options = mergeOptions(options);
  }

  public hasTooManyReferrals(
    userId: string | number,
    attributions: readonly ReferralAttribution[],
    nowMs = Date.now(),
  ): boolean {
    const normalizedUserId = normalizeUserId(userId);
    const count = countRecentAttributionsForReferrer(
      normalizedUserId,
      attributions,
      nowMs,
      this.options.referralWindowMs,
    );

    return count > this.options.maxReferralsPerWindow;
  }

  public evaluateAttribution(
    candidate: ReferralAttribution,
    existingAttributions: readonly ReferralAttribution[],
    existingConversions: readonly ReferralConversion[] = [],
    nowMs = Date.now(),
    quarantineSecret?: string | null,
  ): ReferralAbuseDecision {
    const signals = new Set<ReferralAbuseSignal>();
    const recentReferralCount = countRecentAttributionsForReferrer(
      candidate.referrerUserId,
      existingAttributions,
      nowMs,
      this.options.referralWindowMs,
    );

    if (recentReferralCount >= this.options.maxReferralsPerWindow) {
      signals.add('REFERRAL_VELOCITY_BREACH');
    }

    const recentQualified = countRecentQualifiedConversionsForReferrer(
      candidate.referrerUserId,
      existingAttributions,
      existingConversions,
      nowMs,
      this.options.qualifiedWindowMs,
    );

    if (recentQualified >= this.options.maxQualifiedPerWindow) {
      signals.add('QUALIFIED_SPIKE');
    }

    const collisions = countFingerprintCollisions(candidate, existingAttributions);

    if (collisions.device > this.options.maxFingerprintCollisions) {
      signals.add('DEVICE_CLUSTERING');
    }

    if (collisions.payment > this.options.maxFingerprintCollisions) {
      signals.add('PAYMENT_CLUSTERING');
    }

    if (collisions.household > this.options.maxFingerprintCollisions) {
      signals.add('HOUSEHOLD_CLUSTERING');
    }

    const existingForReferee = existingAttributions.find(
      (entry) =>
        entry.referrerUserId === candidate.referrerUserId &&
        entry.refereeUserId === candidate.refereeUserId &&
        entry.attributionId !== candidate.attributionId &&
        entry.status !== 'REJECTED',
    );

    if (existingForReferee) {
      signals.add('REPEAT_REFEREE');
    }

    const rejectionRate = calculateRejectionRate(
      candidate.referrerUserId,
      existingAttributions,
      nowMs,
      this.options.qualifiedWindowMs,
    );

    if (
      rejectionRate.total >= this.options.minSampleForRejectionRate &&
      rejectionRate.rate >= this.options.maxRejectionRate
    ) {
      signals.add('HIGH_REJECTION_RATE');
    }

    const recentCodeUses = countRecentCodeUses(
      candidate,
      existingAttributions,
      nowMs,
      this.options.referralWindowMs,
    );

    if (recentCodeUses >= this.options.maxCodeUsesPerWindow) {
      signals.add('CODE_BURN_PATTERN');
    }

    const orderedSignals = Array.from(signals).sort();
    const riskScore = clampRiskScore(
      orderedSignals.reduce(
        (sum, signal) => sum + (SIGNAL_WEIGHTS[signal] ?? 0),
        0,
      ),
    );

    let disposition: ReferralAbuseDisposition = 'ALLOW';

    if (riskScore >= this.options.rejectThreshold) {
      disposition = 'REJECT';
    } else if (riskScore >= this.options.reviewThreshold) {
      disposition = 'REVIEW';
    }

    return {
      allowed: disposition !== 'REJECT',
      disposition,
      riskScore,
      signals: orderedSignals,
      rejectionReason:
        disposition === 'REJECT' && orderedSignals.length > 0
          ? toRejectionReason(orderedSignals[0]!)
          : null,
      quarantineMessage: buildQuarantineMessage(
        candidate,
        orderedSignals,
        riskScore,
        disposition,
        quarantineSecret,
      ),
    };
  }

  public throttleNewReferral(
    input: ThrottleNewReferralInput,
  ): ThrottleNewReferralResult {
    const nowMs = input.nowMs ?? Date.now();
    const decision = this.evaluateAttribution(
      input.attribution,
      input.existingAttributions,
      input.existingConversions ?? [],
      nowMs,
      input.quarantineSecret ?? null,
    );

    const attribution: ReferralAttribution =
      decision.disposition === 'REJECT'
        ? {
            ...input.attribution,
            status: 'REJECTED',
            rejectionReason: decision.rejectionReason,
          }
        : input.attribution;

    let receipt: ReceiptLedgerEntry | null = null;

    if (input.receiptLedger) {
      receipt = input.receiptLedger.append({
        eventName:
          decision.disposition === 'ALLOW'
            ? 'referral_abuse_check_passed'
            : decision.disposition === 'REVIEW'
              ? 'referral_abuse_review_required'
              : 'referral_abuse_rejected',
        runId: attribution.programId,
        userId: attribution.referrerUserId,
        tick: 0,
        sequence: input.receiptLedger.size(),
        contentVersion: 'referral-abuse-detector/v1',
        eventAtMs: nowMs,
        fields: {
          attributionId: attribution.attributionId,
          refereeUserId: attribution.refereeUserId,
          disposition: decision.disposition,
          riskScore: decision.riskScore,
          signals: decision.signals,
          reason: decision.rejectionReason,
        },
      });
    }

    return {
      attribution,
      decision,
      receipt,
    };
  }

  public invalidateSuspiciousCompletions(
    input: InvalidateSuspiciousCompletionsInput,
  ): readonly ReferralConversion[] {
    const nowMs = input.nowMs ?? Date.now();
    const attributionById = new Map(
      input.attributions.map((entry) => [entry.attributionId, entry] as const),
    );

    return input.conversions.map((conversion) => {
      if (conversion.status !== 'QUALIFIED') {
        return conversion;
      }

      const attribution = attributionById.get(conversion.attributionId);

      if (!attribution || attribution.status === 'REJECTED') {
        return {
          ...conversion,
          status: 'REJECTED',
        };
      }

      const decision = this.evaluateAttribution(
        attribution,
        input.attributions,
        input.conversions,
        nowMs,
        null,
      );

      if (decision.disposition === 'REJECT') {
        return {
          ...conversion,
          status: 'REJECTED',
        };
      }

      return conversion;
    });
  }

  public logReceipt(input: LogReceiptInput): LoggedReferralReceipt {
    const eventName = input.eventName ?? 'referral_receipt_logged';
    const eventAtMs =
      'signupAtMs' in input.referral
        ? input.referral.signupAtMs
        : input.referral.qualifiedAtMs;

    const runId =
      'programId' in input.referral
        ? input.referral.programId
        : input.referral.attributionId.split(':')[0] ?? 'referrals';

    const userId =
      'referrerUserId' in input.referral
        ? input.referral.referrerUserId
        : input.referral.refereeUserId;

    const identifier =
      'conversionId' in input.referral
        ? (input.referral as ReferralConversion).conversionId
        : (input.referral as ReferralAttribution).attributionId;

    const entry = input.ledger.append({
      eventName,
      runId,
      userId,
      tick: 0,
      sequence: input.ledger.size(),
      contentVersion: 'referral-abuse-detector/v1',
      eventAtMs,
      fields: {
        id: identifier,
        decisionDisposition: input.decision?.disposition ?? null,
        decisionRiskScore: input.decision?.riskScore ?? null,
        decisionSignals: input.decision?.signals ?? [],
      },
    });

    return {
      entry,
      batch:
        typeof input.secret === 'string' && input.secret.length > 0
          ? input.ledger.seal(
              input.secret,
              input.issuedAtMs ?? Date.now(),
            )
          : null,
    };
  }
}

/**
 * Check if a user has too many referrals within a certain timeframe.
 * This now aligns with the repo's referral domain objects instead of a missing ../models package.
 */
export async function hasTooManyReferrals(
  userId: string | number,
  attributions: readonly ReferralAttribution[],
  options?: Partial<ReferralAbuseDetectorOptions>,
): Promise<boolean> {
  const detector = new ReferralAbuseDetector(options);
  return detector.hasTooManyReferrals(userId, attributions);
}

/**
 * Throttle new referrals for a user if they exhibit farm-like behavior.
 */
export async function throttleNewReferral(
  input: ThrottleNewReferralInput,
): Promise<ThrottleNewReferralResult> {
  const detector = new ReferralAbuseDetector(input.options);
  return detector.throttleNewReferral(input);
}

/**
 * Invalidate suspicious completions based on velocity, clustering, and repeat-referee patterns.
 */
export async function invalidateSuspiciousCompletions(
  input: InvalidateSuspiciousCompletionsInput,
): Promise<readonly ReferralConversion[]> {
  const detector = new ReferralAbuseDetector(input.options);
  return detector.invalidateSuspiciousCompletions(input);
}

/**
 * Preserve a ledger of all referral receipts.
 */
export async function logReceipt(
  input: LogReceiptInput,
): Promise<LoggedReferralReceipt> {
  const detector = new ReferralAbuseDetector();
  return detector.logReceipt(input);
}