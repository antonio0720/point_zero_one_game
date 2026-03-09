/**
 * Tier 2 remaining services — Postgres via TypeORM.
 * Pivotal turns, after-action, autopsy, proof stamps, host OS,
 * telemetry schema registry, run explorer.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PivotalTurn, PivotRuleset, ReplaySuggestion,
  AfterAutopsyReport, CounterfactualSim, ForkTurn,
  StampVariant, HostSession, TelemetrySchema,
} from '../entities/tier2_remaining.entity';

// ── Pivotal Turns Service ────────────────────────────────────────────

@Injectable()
export class PivotalTurnsService {
  constructor(
    @InjectRepository(PivotalTurn) private readonly repo: Repository<PivotalTurn>,
  ) {}

  async recordPivot(
    runId: string, turnNumber: number,
    deltaSnapshot: Record<string, unknown>, mlScore: number,
  ): Promise<PivotalTurn> {
    return this.repo.save(this.repo.create({ runId, turnNumber, deltaSnapshot, mlScore }));
  }

  async findByRun(runId: string): Promise<PivotalTurn[]> {
    return this.repo.find({ where: { runId }, order: { turnNumber: 'ASC' } });
  }

  /**
   * Returns 3–7 pivots sorted by ML score for a given run.
   */
  async getTopPivots(runId: string, min = 3, max = 7): Promise<PivotalTurn[]> {
    const all = await this.repo.find({ where: { runId }, order: { mlScore: 'DESC' } });
    return all.slice(0, Math.max(min, Math.min(max, all.length)));
  }
}

// ── Pivot Ruleset Registry ───────────────────────────────────────────

@Injectable()
export class PivotRulesetRegistryService {
  constructor(
    @InjectRepository(PivotRuleset) private readonly repo: Repository<PivotRuleset>,
  ) {}

  async createRuleset(hash: string, rules: unknown[]): Promise<PivotRuleset> {
    return this.repo.save(this.repo.create({ hash, rules }));
  }

  async findByHash(hash: string): Promise<PivotRuleset | null> {
    return this.repo.findOneBy({ hash });
  }
}

// ── Replay Suggester Service ─────────────────────────────────────────

@Injectable()
export class ReplaySuggesterService {
  constructor(
    @InjectRepository(ReplaySuggestion) private readonly repo: Repository<ReplaySuggestion>,
  ) {}

  async suggest(
    playerId: string, failureMode: string,
    scenarioId: string | null, noveltyScore: number,
  ): Promise<ReplaySuggestion> {
    return this.repo.save(this.repo.create({ playerId, failureMode, scenarioId, noveltyScore }));
  }

  async findByPlayer(playerId: string): Promise<ReplaySuggestion[]> {
    return this.repo.find({ where: { playerId }, order: { noveltyScore: 'DESC' } });
  }
}

// ── After Autopsy Report Service ─────────────────────────────────────

@Injectable()
export class AfterAutopsyService {
  constructor(
    @InjectRepository(AfterAutopsyReport) private readonly repo: Repository<AfterAutopsyReport>,
  ) {}

  async create(
    runId: string, causeOfDeathId: string | null,
    barelyLived: boolean, insight: string,
  ): Promise<AfterAutopsyReport> {
    return this.repo.save(this.repo.create({ runId, causeOfDeathId, barelyLived, insight }));
  }

  async findByRun(runId: string): Promise<AfterAutopsyReport | null> {
    return this.repo.findOneBy({ runId });
  }
}

// ── Counterfactual Simulator Service ─────────────────────────────────

@Injectable()
export class CounterfactualSimulatorService {
  constructor(
    @InjectRepository(CounterfactualSim) private readonly repo: Repository<CounterfactualSim>,
  ) {}

  async simulate(
    runId: string, forkTurn: number,
    alternateOutcome: string, outcomeDelta: Record<string, unknown>,
  ): Promise<CounterfactualSim> {
    return this.repo.save(this.repo.create({ runId, forkTurn, alternateOutcome, outcomeDelta }));
  }

  async findByRun(runId: string): Promise<CounterfactualSim[]> {
    return this.repo.find({ where: { runId }, order: { forkTurn: 'ASC' } });
  }
}

// ── Fork Explorer Service ────────────────────────────────────────────

@Injectable()
export class ForkExplorerService {
  constructor(
    @InjectRepository(ForkTurn) private readonly repo: Repository<ForkTurn>,
  ) {}

  async recordFork(
    runId: string, turnNumber: number,
    originalChoice: string, alternateChoice: string,
    outcomeDelta: Record<string, unknown>,
  ): Promise<ForkTurn> {
    return this.repo.save(this.repo.create({
      runId, turnNumber, originalChoice, alternateChoice, outcomeDelta,
    }));
  }

  async findByRun(runId: string): Promise<ForkTurn[]> {
    return this.repo.find({ where: { runId }, order: { turnNumber: 'ASC' } });
  }
}

// ── Stamp Variant Evolution Service ──────────────────────────────────

@Injectable()
export class StampVariantEvolutionService {
  constructor(
    @InjectRepository(StampVariant) private readonly repo: Repository<StampVariant>,
  ) {}

  async evolve(
    stampId: string, streakCount: number, referralCount: number,
  ): Promise<StampVariant> {
    // Visual tier derived from streak + referral inputs
    const tier = 1 + Math.floor(streakCount / 7) + Math.floor(referralCount / 3);
    return this.repo.save(this.repo.create({
      stampId, visualTier: tier, streakCount, referralCount,
    }));
  }

  async findByStamp(stampId: string): Promise<StampVariant[]> {
    return this.repo.find({ where: { stampId }, order: { evolvedAt: 'DESC' } });
  }

  async getLatestTier(stampId: string): Promise<number> {
    const latest = await this.repo.findOne({
      where: { stampId }, order: { evolvedAt: 'DESC' },
    });
    return latest?.visualTier ?? 1;
  }
}

// ── Host Session Service ─────────────────────────────────────────────

@Injectable()
export class HostSessionService {
  constructor(
    @InjectRepository(HostSession) private readonly repo: Repository<HostSession>,
  ) {}

  async create(hostId: string, gameSessionId: string): Promise<HostSession> {
    return this.repo.save(this.repo.create({ hostId, gameSessionId, momentCaptures: [] }));
  }

  async addMomentCapture(id: string, capture: unknown): Promise<HostSession | null> {
    const session = await this.repo.findOneBy({ id });
    if (!session) return null;
    session.momentCaptures = [...(session.momentCaptures as unknown[]), capture];
    return this.repo.save(session);
  }

  async findByHost(hostId: string): Promise<HostSession[]> {
    return this.repo.find({ where: { hostId }, order: { createdAt: 'DESC' } });
  }
}

// ── Telemetry Schema Registry Service ────────────────────────────────

@Injectable()
export class TelemetrySchemaRegistryService {
  constructor(
    @InjectRepository(TelemetrySchema) private readonly repo: Repository<TelemetrySchema>,
  ) {}

  async register(name: string, version: number, definition: Record<string, unknown>): Promise<TelemetrySchema> {
    return this.repo.save(this.repo.create({ name, version, definition }));
  }

  async findByNameAndVersion(name: string, version: number): Promise<TelemetrySchema | null> {
    return this.repo.findOneBy({ name, version });
  }

  async getLatestVersion(name: string): Promise<TelemetrySchema | null> {
    return this.repo.findOne({ where: { name }, order: { version: 'DESC' } });
  }
}

// ── Run Explorer Service (read-only Postgres, replaces MongoDB) ──────

@Injectable()
export class RunExplorerService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async getRunById(runId: string): Promise<unknown | null> {
    const rows = await this.db.query(
      `SELECT * FROM run_history WHERE id = $1 LIMIT 1`, [runId],
    );
    return rows[0] ?? null;
  }

  async getRunsByPlayer(playerId: string, limit = 20): Promise<unknown[]> {
    return this.db.query(
      `SELECT * FROM run_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [playerId, limit],
    );
  }

  async getPublicLeaderboard(limit = 100): Promise<unknown[]> {
    return this.db.query(
      `SELECT rh.id, rh.user_id, rh.outcome, rh.score, rh.created_at
       FROM run_history rh
       WHERE rh.outcome != 'ABANDONED'
       ORDER BY rh.score DESC
       LIMIT $1`,
      [limit],
    );
  }
}
