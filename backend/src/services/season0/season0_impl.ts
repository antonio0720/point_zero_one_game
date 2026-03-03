/**
 * Season 0 — Core Implementation
 * Point Zero One · Density6 LLC · Confidential
 *
 * Responsibilities:
 *   - Idempotent player join (returns existing record on repeat calls)
 *   - Season end-date enforcement
 *   - Level completion + artifact grant (atomic)
 *   - In-memory store for unit tests; swap db property for production
 *
 * Design: Plain class (no NestJS decorators here) so Vitest can
 * instantiate it with `new Season0Impl()` without a DI container.
 * Wire into NestJS via a thin @Injectable() wrapper in season0.module.ts.
 */

import { CountdownClockService } from './countdown_clock';
import { ArtifactGrantService, ArtifactGrantDb, IdentityPayload } from './artifact_grant';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Season0Config {
  endDate?: Date;
  seasonId?: string;
}

export interface PlayerRecord {
  playerId:    string;
  seasonId:    string;
  joinedAt:    Date;
  levels:      Set<number>;
  artifacts:   Map<number, string>; // level → artifact label
}

export interface JoinResult {
  seasonId:   string;
  playerId:   string;
  joinedAt:   Date;
  isExisting: boolean;
  identity:   IdentityPayload | null;
}

// ─── Artifact label map (Season 0 level rewards) ──────────────────────────────

const LEVEL_ARTIFACTS: Record<number, string> = {
  1: 'Artifact for Level 1',
  2: 'Artifact for Level 2',
  3: 'Artifact for Level 3',
  4: 'Artifact for Level 4',
  5: 'Artifact for Level 5',
};

// ─── Implementation ───────────────────────────────────────────────────────────

export class Season0Impl {
  private readonly clock:   CountdownClockService;
  private readonly players: Map<string, PlayerRecord> = new Map();
  private seasonId: string;
  private db: ArtifactGrantDb | null = null;

  constructor(config: Season0Config = {}) {
    this.seasonId = config.seasonId ?? 'SEASON_0';
    this.clock    = new CountdownClockService({ endDate: config.endDate });
  }

  /**
   * (Re-)initialize the service — useful in tests to reset config
   * without reinstantiating the class.
   */
  initialize(config: Season0Config = {}): void {
    if (config.endDate !== undefined) {
      // Rebuild clock with new end date
      (this as unknown as { clock: CountdownClockService }).clock =
        new CountdownClockService({ endDate: config.endDate });
    }
    if (config.seasonId) {
      this.seasonId = config.seasonId;
    }
  }

  /** Inject a real DB adapter for production use. */
  setDb(db: ArtifactGrantDb): void {
    this.db = db;
  }

  // ── Join ──────────────────────────────────────────────────────────────────

  /**
   * Idempotent join:
   *   - If player already joined → return existing record (same seasonId)
   *   - If season has ended → throw 'Season has ended'
   *   - Otherwise → create record + grant artifact bundle
   */
  async join(playerId: string): Promise<JoinResult> {
    // Idempotency — return existing record without re-processing
    const existing = this.players.get(playerId);
    if (existing) {
      return {
        seasonId:   existing.seasonId,
        playerId:   existing.playerId,
        joinedAt:   existing.joinedAt,
        isExisting: true,
        identity:   null,
      };
    }

    // End-date gate
    this.clock.assertSeasonActive();

    // Create player record
    const record: PlayerRecord = {
      playerId,
      seasonId:  this.seasonId,
      joinedAt:  new Date(),
      levels:    new Set(),
      artifacts: new Map(),
    };
    this.players.set(playerId, record);

    // Attempt artifact grant (requires DB; skipped in pure in-memory mode)
    let identity: IdentityPayload | null = null;
    if (this.db) {
      const svc = new ArtifactGrantService(this.db);
      identity = await svc.grantArtifact(Number(playerId) || 0);
    }

    return {
      seasonId:   this.seasonId,
      playerId,
      joinedAt:   record.joinedAt,
      isExisting: false,
      identity,
    };
  }

  // ── Level Completion ──────────────────────────────────────────────────────

  async completeLevel(playerId: string, level: number): Promise<string> {
    this.clock.assertSeasonActive();

    const record = this.players.get(playerId);
    if (!record) {
      throw new Error(`Player has not started Level ${level}`);
    }

    const artifactLabel = LEVEL_ARTIFACTS[level] ?? `Artifact for Level ${level}`;
    record.levels.add(level);
    record.artifacts.set(level, artifactLabel);

    return artifactLabel;
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  getArtifact(playerId: string, level = 1): string | null {
    return this.players.get(playerId)?.artifacts.get(level) ?? null;
  }

  getStatus(playerId: string): PlayerRecord | null {
    return this.players.get(playerId) ?? null;
  }

  isActive(): boolean {
    return this.clock.isSeasonActive();
  }

  getCountdown() {
    return this.clock.getCountdown();
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** Reset all player state — for test teardown only. */
  _reset(): void {
    this.players.clear();
  }
}