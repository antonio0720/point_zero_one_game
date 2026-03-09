/**
 * Liveops services — Postgres via TypeORM.
 * Replaces 10 mongoose files: alerting, notification_sinks, deal_engine,
 * anomaly_detector, snapshot_builder, patch_notes, view_tracking,
 * proof_of_week, verification_health alerts, weekly_challenge.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LiveopsAlert, NotificationSink, Opportunity, Anomaly,
  DailySnapshot, PatchNote, PatchNoteView, ProofOfWeek,
  WeeklyChallenge, WeeklyChallengeEntry,
} from '../../entities/liveops.entity';

// ── Alerting Service ─────────────────────────────────────────────────

@Injectable()
export class AlertingService {
  constructor(
    @InjectRepository(LiveopsAlert) private readonly repo: Repository<LiveopsAlert>,
  ) {}

  async createAlert(gameId: string, severity: number, message: string, alertType = 'health'): Promise<LiveopsAlert> {
    return this.repo.save(this.repo.create({ gameId, severity, message, alertType }));
  }

  async findByGame(gameId: string, limit = 50): Promise<LiveopsAlert[]> {
    return this.repo.find({ where: { gameId }, order: { createdAt: 'DESC' }, take: limit });
  }
}

// ── Notification Sinks Service ───────────────────────────────────────

@Injectable()
export class NotificationSinksService {
  constructor(
    @InjectRepository(NotificationSink) private readonly repo: Repository<NotificationSink>,
  ) {}

  async create(sinkType: string, url?: string, apiKey?: string): Promise<NotificationSink> {
    return this.repo.save(this.repo.create({ sinkType, url: url ?? null, apiKey: apiKey ?? null }));
  }

  async findByType(sinkType: string): Promise<NotificationSink | null> {
    return this.repo.findOneBy({ sinkType });
  }

  async updateLastSent(id: string): Promise<void> {
    await this.repo.update(id, { lastSentAt: new Date() });
  }
}

// ── Deal Engine Service ──────────────────────────────────────────────

@Injectable()
export class DealEngineService {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
  ) {}

  async createOpportunity(name: string): Promise<Opportunity> {
    return this.repo.save(this.repo.create({ name }));
  }

  async updateScore(id: string, score: number): Promise<void> {
    await this.repo.update(id, { score });
  }

  async publishTop(count = 3): Promise<Opportunity[]> {
    const candidates = await this.repo.find({
      where: { published: false },
      order: { score: 'DESC' },
      take: count,
    });
    for (const c of candidates) {
      c.published = true;
    }
    return this.repo.save(candidates);
  }
}

// ── Anomaly Detector Service ─────────────────────────────────────────

@Injectable()
export class AnomalyDetectorService {
  constructor(
    @InjectRepository(Anomaly) private readonly repo: Repository<Anomaly>,
  ) {}

  async detectAnomaly(gameId: string, anomalyType: string, value: number): Promise<Anomaly> {
    return this.repo.save(this.repo.create({ gameId, anomalyType, value }));
  }

  async getAnomalies(gameId: string, anomalyType?: string): Promise<Anomaly[]> {
    const where: Record<string, unknown> = { gameId };
    if (anomalyType) where.anomalyType = anomalyType;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
}

// ── Snapshot Builder Service ─────────────────────────────────────────

@Injectable()
export class SnapshotBuilderService {
  constructor(
    @InjectRepository(DailySnapshot) private readonly repo: Repository<DailySnapshot>,
  ) {}

  async createSnapshot(notes?: string, drilldownLinks: string[] = []): Promise<DailySnapshot> {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await this.repo.findOneBy({ snapshotDate: today });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ snapshotDate: today, notes: notes ?? null, drilldownLinks }));
  }

  async getByDate(date: string): Promise<DailySnapshot | null> {
    return this.repo.findOneBy({ snapshotDate: date });
  }
}

// ── Patch Notes Service ──────────────────────────────────────────────

@Injectable()
export class PatchNotesService {
  constructor(
    @InjectRepository(PatchNote) private readonly repo: Repository<PatchNote>,
  ) {}

  async findByCard(cardId: string): Promise<PatchNote[]> {
    return this.repo.find({ where: { cardId }, order: { version: 'DESC' } });
  }

  async findById(id: string): Promise<PatchNote | null> {
    return this.repo.findOneBy({ id });
  }

  async create(cardId: string, version: number, content: string, rollout = false): Promise<PatchNote> {
    return this.repo.save(this.repo.create({ cardId, version, content, rollout }));
  }
}

// ── View Tracking Service ────────────────────────────────────────────

@Injectable()
export class ViewTrackingService {
  constructor(
    @InjectRepository(PatchNoteView) private readonly repo: Repository<PatchNoteView>,
  ) {}

  async hasViewed(userId: string, patchNoteId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { userId, patchNoteId } });
    return count > 0;
  }

  async markViewed(userId: string, patchNoteId: string): Promise<void> {
    const existing = await this.repo.findOneBy({ userId, patchNoteId });
    if (!existing) {
      await this.repo.save(this.repo.create({ userId, patchNoteId }));
    }
  }
}

// ── Proof of Week Service ────────────────────────────────────────────

@Injectable()
export class ProofOfWeekService {
  constructor(
    @InjectRepository(ProofOfWeek) private readonly repo: Repository<ProofOfWeek>,
  ) {}

  async selectWinner(gameRunId: string, impactScore: number, shareRate: number): Promise<ProofOfWeek> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);

    return this.repo.save(this.repo.create({
      gameRunId, impactScore, shareRate, verified: true,
      weekStart: weekStart.toISOString().slice(0, 10),
    }));
  }

  async getByWeek(weekStart: string): Promise<ProofOfWeek | null> {
    return this.repo.findOneBy({ weekStart });
  }
}

// ── Weekly Challenge Service ─────────────────────────────────────────

@Injectable()
export class WeeklyChallengeService {
  constructor(
    @InjectRepository(WeeklyChallenge) private readonly challengeRepo: Repository<WeeklyChallenge>,
    @InjectRepository(WeeklyChallengeEntry) private readonly entryRepo: Repository<WeeklyChallengeEntry>,
  ) {}

  async createChallenge(scenario: string, constraint_?: string): Promise<WeeklyChallenge> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());
    weekStart.setUTCHours(0, 0, 0, 0);

    return this.challengeRepo.save(this.challengeRepo.create({
      scenario, constraint_: constraint_ ?? null,
      weekStart: weekStart.toISOString().slice(0, 10),
    }));
  }

  async submitEntry(challengeId: string, playerId: string, score: number): Promise<WeeklyChallengeEntry> {
    let entry = await this.entryRepo.findOneBy({ challengeId, playerId });
    if (entry) {
      entry.score = Math.max(entry.score, score);
      return this.entryRepo.save(entry);
    }
    return this.entryRepo.save(this.entryRepo.create({ challengeId, playerId, score }));
  }

  async getLeaderboard(challengeId: string, limit = 50): Promise<WeeklyChallengeEntry[]> {
    return this.entryRepo.find({ where: { challengeId }, order: { score: 'DESC' }, take: limit });
  }

  async getParticipantCount(challengeId: string): Promise<number> {
    return this.entryRepo.count({ where: { challengeId } });
  }
}
