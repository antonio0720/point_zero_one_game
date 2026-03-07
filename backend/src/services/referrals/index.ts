//backend/src/services/referrals/index.ts
import { createHash } from 'node:crypto';

export type ReferralConversionStatus =
  | 'PENDING'
  | 'QUALIFIED'
  | 'REJECTED'
  | 'REWARDED';

export interface ReferralProgram {
  readonly programId: string;
  readonly codePrefix: string;
  readonly attributionWindowDays: number;
  readonly maxUsesPerCode: number;
  readonly referrerRewardCents: number;
  readonly refereeRewardCents: number;
}

export interface ReferralCode {
  readonly codeId: string;
  readonly programId: string;
  readonly ownerUserId: string;
  readonly code: string;
  readonly createdAtMs: number;
  readonly uses: number;
  readonly disabled: boolean;
}

export interface ReferralAttributionRequest {
  readonly programId: string;
  readonly code: string;
  readonly newUserId: string;
  readonly signupAtMs: number;
  readonly deviceFingerprint?: string | null;
  readonly paymentFingerprint?: string | null;
  readonly householdFingerprint?: string | null;
}

export interface ReferralAttribution {
  readonly attributionId: string;
  readonly programId: string;
  readonly codeId: string;
  readonly referrerUserId: string;
  readonly refereeUserId: string;
  readonly signupAtMs: number;
  readonly expiresAtMs: number;
  readonly deviceFingerprint: string | null;
  readonly paymentFingerprint: string | null;
  readonly householdFingerprint: string | null;
  readonly status: ReferralConversionStatus;
  readonly rejectionReason: string | null;
}

export interface ReferralConversion {
  readonly conversionId: string;
  readonly attributionId: string;
  readonly refereeUserId: string;
  readonly qualifiedAtMs: number;
  readonly orderValueCents: number;
  readonly status: ReferralConversionStatus;
}

export interface ReferralReward {
  readonly rewardId: string;
  readonly attributionId: string;
  readonly beneficiaryUserId: string;
  readonly amountCents: number;
  readonly issuedAtMs: number;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function buildCode(prefix: string, ownerUserId: string, createdAtMs: number): string {
  const digest = sha256(`${prefix}:${ownerUserId}:${createdAtMs}`).slice(0, 8).toUpperCase();
  return `${prefix}-${digest}`;
}

function sameFingerprint(lhs?: string | null, rhs?: string | null): boolean {
  return typeof lhs === 'string' && lhs.length > 0 && lhs === rhs;
}

export class ReferralService {
  public issueCode(
    program: ReferralProgram,
    ownerUserId: string,
    createdAtMs = Date.now(),
  ): ReferralCode {
    const code = buildCode(program.codePrefix, ownerUserId, createdAtMs);
    return {
      codeId: `${program.programId}:${ownerUserId}:${createdAtMs}`,
      programId: program.programId,
      ownerUserId,
      code,
      createdAtMs,
      uses: 0,
      disabled: false,
    };
  }

  public attributeSignup(
    request: ReferralAttributionRequest,
    program: ReferralProgram,
    codes: readonly ReferralCode[],
    existingAttributions: readonly ReferralAttribution[],
  ): ReferralAttribution {
    const code = codes.find(
      (entry) =>
        entry.programId === request.programId &&
        entry.code === request.code &&
        !entry.disabled,
    );

    if (!code) {
      return this.rejectedAttribution(request, 'CODE_NOT_FOUND');
    }

    if (code.uses >= program.maxUsesPerCode) {
      return this.rejectedAttribution(request, 'CODE_USE_CAP_REACHED');
    }

    if (code.ownerUserId === request.newUserId) {
      return this.rejectedAttribution(request, 'SELF_REFERRAL_BLOCKED');
    }

    const conflicting = existingAttributions.find(
      (entry) =>
        entry.programId === request.programId &&
        entry.refereeUserId === request.newUserId &&
        entry.status !== 'REJECTED',
    );

    if (conflicting) {
      return this.rejectedAttribution(request, 'REFEREE_ALREADY_ATTRIBUTED');
    }

    const riskyAttribution = existingAttributions.find(
      (entry) =>
        entry.referrerUserId === code.ownerUserId &&
        (sameFingerprint(entry.deviceFingerprint, request.deviceFingerprint) ||
          sameFingerprint(entry.paymentFingerprint, request.paymentFingerprint) ||
          sameFingerprint(entry.householdFingerprint, request.householdFingerprint)),
    );

    if (riskyAttribution) {
      return this.rejectedAttribution(request, 'FINGERPRINT_COLLISION');
    }

    return {
      attributionId: `${code.codeId}:${request.newUserId}`,
      programId: request.programId,
      codeId: code.codeId,
      referrerUserId: code.ownerUserId,
      refereeUserId: request.newUserId,
      signupAtMs: request.signupAtMs,
      expiresAtMs:
        request.signupAtMs + program.attributionWindowDays * 24 * 60 * 60 * 1000,
      deviceFingerprint: request.deviceFingerprint ?? null,
      paymentFingerprint: request.paymentFingerprint ?? null,
      householdFingerprint: request.householdFingerprint ?? null,
      status: 'PENDING',
      rejectionReason: null,
    };
  }

  public qualifyConversion(
    attribution: ReferralAttribution,
    orderValueCents: number,
    qualifiedAtMs = Date.now(),
  ): ReferralConversion {
    if (attribution.status === 'REJECTED') {
      return {
        conversionId: `${attribution.attributionId}:rejected`,
        attributionId: attribution.attributionId,
        refereeUserId: attribution.refereeUserId,
        qualifiedAtMs,
        orderValueCents,
        status: 'REJECTED',
      };
    }

    if (qualifiedAtMs > attribution.expiresAtMs) {
      return {
        conversionId: `${attribution.attributionId}:expired`,
        attributionId: attribution.attributionId,
        refereeUserId: attribution.refereeUserId,
        qualifiedAtMs,
        orderValueCents,
        status: 'REJECTED',
      };
    }

    return {
      conversionId: `${attribution.attributionId}:${qualifiedAtMs}`,
      attributionId: attribution.attributionId,
      refereeUserId: attribution.refereeUserId,
      qualifiedAtMs,
      orderValueCents,
      status: 'QUALIFIED',
    };
  }

  public materializeRewards(
    program: ReferralProgram,
    attribution: ReferralAttribution,
    conversion: ReferralConversion,
  ): readonly ReferralReward[] {
    if (conversion.status !== 'QUALIFIED' || attribution.status === 'REJECTED') {
      return [];
    }

    const issuedAtMs = conversion.qualifiedAtMs;

    return [
      {
        rewardId: `${conversion.conversionId}:referrer`,
        attributionId: attribution.attributionId,
        beneficiaryUserId: attribution.referrerUserId,
        amountCents: program.referrerRewardCents,
        issuedAtMs,
      },
      {
        rewardId: `${conversion.conversionId}:referee`,
        attributionId: attribution.attributionId,
        beneficiaryUserId: attribution.refereeUserId,
        amountCents: program.refereeRewardCents,
        issuedAtMs,
      },
    ];
  }

  private rejectedAttribution(
    request: ReferralAttributionRequest,
    reason: string,
  ): ReferralAttribution {
    return {
      attributionId: `${request.programId}:${request.newUserId}:rejected`,
      programId: request.programId,
      codeId: `${request.programId}:unknown`,
      referrerUserId: 'unknown',
      refereeUserId: request.newUserId,
      signupAtMs: request.signupAtMs,
      expiresAtMs: request.signupAtMs,
      deviceFingerprint: request.deviceFingerprint ?? null,
      paymentFingerprint: request.paymentFingerprint ?? null,
      householdFingerprint: request.householdFingerprint ?? null,
      status: 'REJECTED',
      rejectionReason: reason,
    };
  }
}

export function incrementReferralCodeUse(code: ReferralCode): ReferralCode {
  return {
    ...code,
    uses: code.uses + 1,
  };
}