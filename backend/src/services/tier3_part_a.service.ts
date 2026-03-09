/**
 * Tier 3 Services — Part A
 * B2B, biometric, card_forge, commerce, companion, creator_profiles, referrals, share_engine
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  B2BTenant, B2BSeat, WellnessAnalytics, BiometricEvent,
  CommunityCard, DeathScreenTrigger, GauntletVote,
  EntitlementCompat, CardScan, CreatorPermission,
} from '../entities/tier3_part_a.entity';
import {
  ReferralCode, ReferralRewardUnlock, ReferralReceipt,
  ClipMetadata, ShareArtifact,
} from '../entities/tier3_part_b.entity';

// ── B2B Tenant Service ───────────────────────────────────────────────

@Injectable()
export class B2BTenantService {
  constructor(
    @InjectRepository(B2BTenant) private readonly tenantRepo: Repository<B2BTenant>,
    @InjectRepository(B2BSeat) private readonly seatRepo: Repository<B2BSeat>,
  ) {}

  async createTenant(name: string, ssoIdpUrl?: string, ssoClientId?: string, ssoClientSecret?: string): Promise<B2BTenant> {
    return this.tenantRepo.save(this.tenantRepo.create({
      name, ssoIdpUrl: ssoIdpUrl ?? null, ssoClientId: ssoClientId ?? null, ssoClientSecret: ssoClientSecret ?? null,
    }));
  }

  async provisionSeats(tenantId: string, count: number): Promise<B2BSeat[]> {
    const seats = Array.from({ length: count }, () => this.seatRepo.create({ tenantId }));
    return this.seatRepo.save(seats);
  }

  async assignSeat(seatId: string, userEmail: string): Promise<void> {
    await this.seatRepo.update(seatId, { userEmail, assigned: true });
  }

  async revokeSeat(seatId: string): Promise<void> {
    await this.seatRepo.update(seatId, { userEmail: null, assigned: false });
  }
}

// ── Wellness Analytics Service ───────────────────────────────────────

@Injectable()
export class WellnessAnalyticsService {
  constructor(@InjectRepository(WellnessAnalytics) private readonly repo: Repository<WellnessAnalytics>) {}

  async create(organizationId: string, survivalRate: number, failureMode: string, riskLiteracyScore: number): Promise<WellnessAnalytics> {
    return this.repo.save(this.repo.create({ organizationId, survivalRate, failureMode, riskLiteracyScore }));
  }

  async findByOrg(organizationId: string): Promise<WellnessAnalytics | null> {
    return this.repo.findOneBy({ organizationId });
  }
}

// ── Biometric Analytics Service ──────────────────────────────────────

@Injectable()
export class AnonymizedStressAnalyticsService {
  constructor(@InjectRepository(BiometricEvent) private readonly repo: Repository<BiometricEvent>) {}

  async getAverageStressDelta(cardId: string): Promise<number> {
    const result = await this.repo.createQueryBuilder('e')
      .select('AVG(e.stress_delta)', 'avg')
      .where('e.card_id = :cardId', { cardId })
      .getRawOne();
    return parseFloat(result?.avg ?? '0');
  }

  async recordEvent(cardId: string, stressDelta: number): Promise<BiometricEvent> {
    return this.repo.save(this.repo.create({ cardId, stressDelta }));
  }
}

// ── Card Forge Services ──────────────────────────────────────────────

@Injectable()
export class CreatorRoyaltyService {
  constructor(@InjectRepository(CommunityCard) private readonly repo: Repository<CommunityCard>) {}

  async trackGamePlayed(cardId: string): Promise<void> {
    await this.repo.increment({ id: cardId }, 'gamesPlayed', 1);
  }

  async getCard(cardId: string): Promise<CommunityCard | null> {
    return this.repo.findOneBy({ id: cardId });
  }
}

@Injectable()
export class DeathScreenTriggerService {
  constructor(@InjectRepository(DeathScreenTrigger) private readonly repo: Repository<DeathScreenTrigger>) {}

  async onRunFinalized(accountId: string): Promise<{ eligible: boolean }> {
    let trigger = await this.repo.findOneBy({ accountId });
    if (!trigger) {
      trigger = await this.repo.save(this.repo.create({ accountId, deathsCount: 1 }));
    } else {
      trigger.deathsCount += 1;
      trigger.lastDeathAt = new Date();
      await this.repo.save(trigger);
    }
    const eligible = trigger.deathsCount % 5 === 0 && trigger.accountAgeSec > 7 * 86400;
    return { eligible };
  }
}

@Injectable()
export class GauntletVotingService {
  constructor(@InjectRepository(GauntletVote) private readonly repo: Repository<GauntletVote>) {}

  async castVote(submissionId: string, voterId: string, voteType: string): Promise<GauntletVote> {
    return this.repo.save(this.repo.create({ submissionId, voterId, voteType }));
  }

  async getVotes(submissionId: string): Promise<GauntletVote[]> {
    return this.repo.find({ where: { submissionId } });
  }
}

// ── Commerce Compatibility Resolver ──────────────────────────────────

@Injectable()
export class CompatibilityResolverService {
  constructor(@InjectRepository(EntitlementCompat) private readonly repo: Repository<EntitlementCompat>) {}

  async resolveCompatibilities(taxonomyId: string): Promise<EntitlementCompat[]> {
    return this.repo.find({ where: { taxonomyId } });
  }
}

// ── Companion Card Scan Service ──────────────────────────────────────

@Injectable()
export class CardScanService {
  constructor(@InjectRepository(CardScan) private readonly repo: Repository<CardScan>) {}

  async scan(cardId: string): Promise<CardScan | null> {
    return this.repo.findOneBy({ cardId });
  }
}

// ── Creator Permissions Matrix ───────────────────────────────────────

@Injectable()
export class PermissionsMatrixService {
  constructor(@InjectRepository(CreatorPermission) private readonly repo: Repository<CreatorPermission>) {}

  async check(level: string, publishType: string): Promise<boolean> {
    const perm = await this.repo.findOneBy({ level, publishType });
    return perm?.canPublish ?? false;
  }

  async set(level: string, publishType: string, canPublish: boolean): Promise<void> {
    const existing = await this.repo.findOneBy({ level, publishType });
    if (existing) { existing.canPublish = canPublish; await this.repo.save(existing); }
    else { await this.repo.save(this.repo.create({ level, publishType, canPublish })); }
  }
}

// ── Referrals Service ────────────────────────────────────────────────

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(ReferralCode) private readonly codeRepo: Repository<ReferralCode>,
    @InjectRepository(ReferralRewardUnlock) private readonly unlockRepo: Repository<ReferralRewardUnlock>,
    @InjectRepository(ReferralReceipt) private readonly receiptRepo: Repository<ReferralReceipt>,
  ) {}

  async createCode(ownerId: string): Promise<ReferralCode> {
    const code = `PZO-${Date.now().toString(36).toUpperCase()}`;
    return this.codeRepo.save(this.codeRepo.create({ code, ownerId }));
  }

  async useCode(code: string, usedBy: string): Promise<void> {
    await this.codeRepo.update({ code }, { used: true, usedBy });
  }

  async trackCompletion(code: string): Promise<void> {
    await this.codeRepo.increment({ code }, 'runsCount', 1);
  }

  async unlockRewards(referralId: string, cosmeticVariantId?: string, stampVariantId?: string): Promise<void> {
    await this.unlockRepo.save(this.unlockRepo.create({
      referralId, cosmeticVariantId: cosmeticVariantId ?? null, stampVariantId: stampVariantId ?? null,
    }));
    await this.receiptRepo.save(this.receiptRepo.create({ referralId }));
  }
}

// ── Share Engine Services ────────────────────────────────────────────

@Injectable()
export class ClipCaptureService {
  constructor(@InjectRepository(ClipMetadata) private readonly repo: Repository<ClipMetadata>) {}

  async queueJob(runId: string, momentType: string, turnStart: number, turnEnd: number): Promise<ClipMetadata> {
    return this.repo.save(this.repo.create({ runId, momentType, turnStart, turnEnd, status: 'pending' }));
  }

  async getPending(): Promise<ClipMetadata[]> {
    return this.repo.find({ where: { status: 'pending' } });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.repo.update(id, { status });
  }
}

@Injectable()
export class ShareEngineService {
  constructor(@InjectRepository(ShareArtifact) private readonly repo: Repository<ShareArtifact>) {}

  async generateShareCard(gameSessionId: string, ogMeta: Record<string, unknown>): Promise<ShareArtifact> {
    return this.repo.save(this.repo.create({ gameSessionId, ogMeta }));
  }

  async getShareArtifact(id: string): Promise<ShareArtifact | null> {
    return this.repo.findOneBy({ id });
  }
}
