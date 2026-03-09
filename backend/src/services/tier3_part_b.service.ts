/**
 * Tier 3 Services — Part B
 * Curriculum, episodes, events, experiments, generational, integrity,
 * moderation, monetization, partners, licensing, UGC, misc
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CurriculumOrg, CurriculumCohort, SsoHook, EpisodeVersionPin,
  FounderNightEvent, Experiment, Bloodline, TransparencyRollup,
  Appeal, ModerationAction, SkuTag, PartnerEnrollment, PartnerRollup,
  LcpCohort, LcpExportJob, LcpPack, RankedCompat, PolicyScan,
  RunVisibility, RevshareLedger, SandboxLane, SentimentState, ToxicityScan,
} from '../entities/tier3_part_b.entity';
import { UgcArtifact, UgcSubmission, UgcSimCheck } from '../entities/tier3_part_b.entity';

// ── Curriculum Services ──────────────────────────────────────────────

@Injectable()
export class OrgRegistryService {
  constructor(
    @InjectRepository(CurriculumOrg) private readonly orgRepo: Repository<CurriculumOrg>,
    @InjectRepository(CurriculumCohort) private readonly cohortRepo: Repository<CurriculumCohort>,
  ) {}

  async createOrg(name: string, slug: string): Promise<CurriculumOrg> {
    return this.orgRepo.save(this.orgRepo.create({ name, slug }));
  }

  async findOrgBySlug(slug: string): Promise<CurriculumOrg | null> {
    return this.orgRepo.findOneBy({ slug });
  }

  async createCohort(orgId: string, name: string): Promise<CurriculumCohort> {
    return this.cohortRepo.save(this.cohortRepo.create({ orgId, name }));
  }

  async getCohortsByOrg(orgId: string): Promise<CurriculumCohort[]> {
    return this.cohortRepo.find({ where: { orgId } });
  }
}

@Injectable()
export class SsoHooksService {
  constructor(@InjectRepository(SsoHook) private readonly repo: Repository<SsoHook>) {}

  async create(institutionId: string, ssoProvider: string, ssoClientId: string, ssoCallbackUrl: string): Promise<SsoHook> {
    return this.repo.save(this.repo.create({ institutionId, ssoProvider, ssoClientId, ssoCallbackUrl }));
  }

  async findByInstitution(institutionId: string): Promise<SsoHook[]> {
    return this.repo.find({ where: { institutionId } });
  }
}

@Injectable()
export class NextRunRecommendationsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async recommend(playerId: string): Promise<{ packId: string; recommendedLevel: number }[]> {
    const rows = await this.db.query(
      `SELECT pack_id, MAX(level_reached) + 1 as next_level
       FROM run_history WHERE user_id = $1
       GROUP BY pack_id ORDER BY next_level DESC LIMIT 5`,
      [playerId],
    );
    return rows.map((r: { pack_id: string; next_level: number }) => ({
      packId: r.pack_id, recommendedLevel: r.next_level,
    }));
  }
}

// ── Episodes Services ────────────────────────────────────────────────

@Injectable()
export class EpisodeVersionPinService {
  constructor(@InjectRepository(EpisodeVersionPin) private readonly repo: Repository<EpisodeVersionPin>) {}

  async pin(episodeId: string, version: number, contentHash: string): Promise<EpisodeVersionPin> {
    return this.repo.save(this.repo.create({ episodeId, version, contentHash }));
  }

  async getPin(episodeId: string, version: number): Promise<EpisodeVersionPin | null> {
    return this.repo.findOneBy({ episodeId, version });
  }

  async rollback(episodeId: string, targetVersion: number): Promise<EpisodeVersionPin | null> {
    return this.repo.findOneBy({ episodeId, version: targetVersion });
  }
}

// ── Events Services ──────────────────────────────────────────────────

@Injectable()
export class FounderNightService {
  constructor(@InjectRepository(FounderNightEvent) private readonly repo: Repository<FounderNightEvent>) {}

  async create(eventName: string, season: number, eventData: Record<string, unknown>): Promise<FounderNightEvent> {
    return this.repo.save(this.repo.create({ eventName, season, eventData }));
  }

  async getBySeason(season: number): Promise<FounderNightEvent[]> {
    return this.repo.find({ where: { season }, order: { createdAt: 'DESC' } });
  }
}

// ── Experiments Service ──────────────────────────────────────────────

@Injectable()
export class ExperimentsService {
  constructor(@InjectRepository(Experiment) private readonly repo: Repository<Experiment>) {}

  async create(name: string, description: string): Promise<Experiment> {
    return this.repo.save(this.repo.create({ name, description }));
  }

  async findActive(): Promise<Experiment[]> {
    return this.repo.find({ where: { status: 'active' } });
  }

  async complete(id: string): Promise<void> {
    await this.repo.update(id, { status: 'completed', endDate: new Date() });
  }
}

// ── Bloodline Service ────────────────────────────────────────────────

@Injectable()
export class BloodlineService {
  constructor(@InjectRepository(Bloodline) private readonly repo: Repository<Bloodline>) {}

  async advanceGeneration(playerId: string, runId: string, outcome: number): Promise<Bloodline> {
    const latest = await this.repo.findOne({ where: { playerId }, order: { generation: 'DESC' } });
    const gen = (latest?.generation ?? 0) + 1;
    return this.repo.save(this.repo.create({ playerId, generation: gen, runId, outcome }));
  }

  async getHistory(playerId: string): Promise<Bloodline[]> {
    return this.repo.find({ where: { playerId }, order: { generation: 'ASC' } });
  }
}

// ── Integrity / Moderation Services ──────────────────────────────────

@Injectable()
export class TransparencyRollupsService {
  constructor(@InjectRepository(TransparencyRollup) private readonly repo: Repository<TransparencyRollup>) {}

  async generateRollup(periodStart: string, periodEnd: string, rollupData: Record<string, unknown>): Promise<TransparencyRollup> {
    return this.repo.save(this.repo.create({ periodStart, periodEnd, rollupData }));
  }
}

@Injectable()
export class AppealsPipelineService {
  constructor(@InjectRepository(Appeal) private readonly repo: Repository<Appeal>) {}

  async create(userId: string, reason: string): Promise<Appeal> {
    return this.repo.save(this.repo.create({ userId, reason }));
  }

  async review(id: string, outcome: string, approved: boolean): Promise<void> {
    await this.repo.update(id, { status: approved ? 'approved' : 'denied', outcome });
  }

  async findPending(): Promise<Appeal[]> {
    return this.repo.find({ where: { status: 'pending' }, order: { createdAt: 'ASC' } });
  }
}

@Injectable()
export class ModerationActionsService {
  constructor(@InjectRepository(ModerationAction) private readonly repo: Repository<ModerationAction>) {}

  async create(targetId: string, actionType: string, reason: string): Promise<ModerationAction> {
    return this.repo.save(this.repo.create({ targetId, actionType, reason }));
  }

  async findByTarget(targetId: string): Promise<ModerationAction[]> {
    return this.repo.find({ where: { targetId }, order: { createdAt: 'DESC' } });
  }
}

@Injectable()
export class SkuTagEnforcerService {
  constructor(@InjectRepository(SkuTag) private readonly repo: Repository<SkuTag>) {}

  async enforce(tag: string): Promise<SkuTag> {
    const existing = await this.repo.findOneBy({ tag });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ tag }));
  }

  async getAll(): Promise<SkuTag[]> {
    return this.repo.find();
  }
}

// ── Partners / Licensing Services ────────────────────────────────────

@Injectable()
export class EnrollmentService {
  constructor(@InjectRepository(PartnerEnrollment) private readonly repo: Repository<PartnerEnrollment>) {}

  async enroll(partnerId: string, cohortId?: string): Promise<PartnerEnrollment> {
    return this.repo.save(this.repo.create({ partnerId, cohortId: cohortId ?? null }));
  }

  async approve(id: string): Promise<void> {
    await this.repo.update(id, { status: 'approved' });
  }
}

@Injectable()
export class PartnerRollupService {
  constructor(@InjectRepository(PartnerRollup) private readonly repo: Repository<PartnerRollup>) {}

  async generateRollup(partnerId: string, period: string, rollupData: Record<string, unknown>): Promise<PartnerRollup> {
    return this.repo.save(this.repo.create({ partnerId, period, rollupData }));
  }
}

@Injectable()
export class LcpCohortService {
  constructor(@InjectRepository(LcpCohort) private readonly repo: Repository<LcpCohort>) {}

  async create(name: string, scheduleWindow: Record<string, unknown>, ladderPolicy: Record<string, unknown>): Promise<LcpCohort> {
    return this.repo.save(this.repo.create({ name, scheduleWindow, ladderPolicy }));
  }
}

@Injectable()
export class LcpExportService {
  constructor(@InjectRepository(LcpExportJob) private readonly repo: Repository<LcpExportJob>) {}

  async createJob(jobType: string): Promise<LcpExportJob> {
    return this.repo.save(this.repo.create({ jobType }));
  }

  async completeJob(id: string, signedUrl: string, expiresAt: Date): Promise<void> {
    await this.repo.update(id, { status: 'completed', signedUrl, expiresAt });
  }
}

@Injectable()
export class PackLibraryService {
  constructor(@InjectRepository(LcpPack) private readonly repo: Repository<LcpPack>) {}

  async create(institutionId: string, name: string): Promise<LcpPack> {
    return this.repo.save(this.repo.create({ institutionId, name }));
  }

  async publish(id: string): Promise<void> {
    await this.repo.update(id, { isPublished: true });
  }
}

// ── UGC Services ─────────────────────────────────────────────────────

@Injectable()
export class UgcIngestService {
  constructor(@InjectRepository(UgcArtifact) private readonly repo: Repository<UgcArtifact>) {}

  async ingest(creatorId: string, data: Record<string, unknown>): Promise<UgcArtifact> {
    return this.repo.save(this.repo.create({ creatorId, data }));
  }
}

@Injectable()
export class UgcPipelineService {
  constructor(
    @InjectRepository(UgcSubmission) private readonly subRepo: Repository<UgcSubmission>,
    @InjectRepository(UgcArtifact) private readonly artRepo: Repository<UgcArtifact>,
  ) {}

  async submit(artifactId: string): Promise<UgcSubmission> {
    return this.subRepo.save(this.subRepo.create({ artifactId }));
  }

  async advance(id: string, status: string): Promise<void> {
    await this.subRepo.update(id, { status });
  }
}

@Injectable()
export class DeterministicSimCheckService {
  constructor(@InjectRepository(UgcSimCheck) private readonly repo: Repository<UgcSimCheck>) {}

  async check(replayId: string, originalHash: string, simulatedHash: string, differences: string[]): Promise<UgcSimCheck> {
    return this.repo.save(this.repo.create({
      replayId, originalReplayHash: originalHash, simulatedReplayHash: simulatedHash, differences,
    }));
  }
}

// ── Misc Services ────────────────────────────────────────────────────

@Injectable()
export class RankedCompatService {
  constructor(@InjectRepository(RankedCompat) private readonly repo: Repository<RankedCompat>) {}

  async check(playerId: string, runId: string): Promise<boolean> {
    const entry = await this.repo.findOneBy({ playerId, runId });
    return entry?.eligible ?? false;
  }

  async record(playerId: string, runId: string, eligible: boolean, entitlement: string): Promise<RankedCompat> {
    return this.repo.save(this.repo.create({ playerId, runId, eligible, entitlement }));
  }
}

@Injectable()
export class PolicyScanService {
  constructor(@InjectRepository(PolicyScan) private readonly repo: Repository<PolicyScan>) {}

  async scan(title: string, description?: string, tags: string[] = []): Promise<PolicyScan> {
    return this.repo.save(this.repo.create({ title, description: description ?? null, tags }));
  }
}

@Injectable()
export class RunVisibilityService {
  constructor(@InjectRepository(RunVisibility) private readonly repo: Repository<RunVisibility>) {}

  async setVisibility(runId: string, userId: string, visibility: string): Promise<void> {
    const existing = await this.repo.findOneBy({ runId });
    if (existing) { existing.visibility = visibility; await this.repo.save(existing); }
    else { await this.repo.save(this.repo.create({ runId, userId, visibility })); }
  }

  async getVisibility(runId: string): Promise<string> {
    const entry = await this.repo.findOneBy({ runId });
    return entry?.visibility ?? 'public';
  }
}

@Injectable()
export class RevshareLedgerService {
  constructor(@InjectRepository(RevshareLedger) private readonly repo: Repository<RevshareLedger>) {}

  async recordEntry(gameId: string, engagementId: string, period: number, amount: number, receiptHash?: string): Promise<RevshareLedger> {
    return this.repo.save(this.repo.create({ gameId, engagementId, period, amount, receiptHash: receiptHash ?? null }));
  }

  async findByGame(gameId: string): Promise<RevshareLedger[]> {
    return this.repo.find({ where: { gameId }, order: { createdAt: 'DESC' } });
  }
}

@Injectable()
export class SandboxLanesService {
  constructor(@InjectRepository(SandboxLane) private readonly repo: Repository<SandboxLane>) {}

  async create(privateId: string, cohortId?: string, eventId?: string): Promise<SandboxLane> {
    return this.repo.save(this.repo.create({ privateId, cohortId: cohortId ?? null, eventId: eventId ?? null }));
  }
}

@Injectable()
export class EmpathyModeService {
  constructor(@InjectRepository(SentimentState) private readonly repo: Repository<SentimentState>) {}

  async getState(playerId: string): Promise<SentimentState | null> {
    return this.repo.findOneBy({ playerId });
  }

  async updateSentiment(playerId: string, sentimentScore: number, turnData: unknown): Promise<SentimentState> {
    let state = await this.repo.findOneBy({ playerId });
    if (!state) {
      state = this.repo.create({ playerId, sentimentScore, historyWindow: [turnData] });
    } else {
      state.sentimentScore = sentimentScore;
      const history = (state.historyWindow as unknown[]).slice(-2);
      history.push(turnData);
      state.historyWindow = history;
    }
    return this.repo.save(state);
  }

  async toggleEmpathyMode(playerId: string, enabled: boolean): Promise<void> {
    await this.repo.update({ playerId }, { empathyMode: enabled });
  }
}

@Injectable()
export class ToxicityScanService {
  constructor(@InjectRepository(ToxicityScan) private readonly repo: Repository<ToxicityScan>) {}

  async scan(contentId: string, scanType: string, result: Record<string, unknown>, flagged: boolean): Promise<ToxicityScan> {
    return this.repo.save(this.repo.create({ contentId, scanType, result, flagged }));
  }

  async getFlagged(): Promise<ToxicityScan[]> {
    return this.repo.find({ where: { flagged: true }, order: { createdAt: 'DESC' } });
  }
}
