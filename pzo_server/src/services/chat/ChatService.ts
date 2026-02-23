/**
 * ChatService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * DEAL ROOM & MARKET MOVE ALERT SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * What this covers:
 *   T194 — Publish rich Market Move Alert cards with Syndicate banners,
 *           phase countdowns, Capital Score, and deep links.
 *   T198 — War Fanout Stress Protocol: load-test Deal Room + alert fanout
 *           under concurrent rivalry simulation.
 *
 * Design law:
 *   Market Move Alerts are minted once per rivalry + phase.
 *   Safe to retry. No duplicate broadcasts. No vibes. Platform-provable.
 *
 * Deal Room transcript integrity:
 *   UNSEND is forbidden in any DEAL_ROOM channel.
 *   Logs are part of the official rivalry record.
 *   The platform can prove what was said.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RivalryPhase =
  | 'NOTICE_FILED'
  | 'DUE_DILIGENCE'
  | 'CAPITAL_BATTLE'
  | 'LEDGER_CLOSE'
  | 'CLOSED';

export type ChannelType =
  | 'GLOBAL'
  | 'SERVER'
  | 'SYNDICATE'
  | 'DEAL_ROOM'   // Rivalry-scoped private channel — transcript integrity enforced
  | 'DIRECT';

export interface SyndicateBannerMeta {
  syndicateId: string;
  name:        string;
  banner:      string;   // CDN URL
  capitalScore: number;
}

/**
 * T194: Market Move Alert payload.
 * Rich card published to GLOBAL / SERVER / SYNDICATE channels when a rivalry
 * files a notice, enters CAPITAL_BATTLE, or closes with final outcome.
 *
 * Client renders: banners, live countdown, Capital Score delta, deep link CTA.
 * No text-only fallback — this is a first-class card object.
 */
export interface MarketMoveAlertPayload {
  rivalryId:           string;
  phase:               RivalryPhase;
  challenger:          SyndicateBannerMeta;
  defender:            SyndicateBannerMeta;
  phaseEndsAt:         string;          // ISO — client renders countdown
  deepLink:            string;          // Routes to Deal Room or Rivalry History
  proofHash?:          string;          // Present only on CLOSED phase
  yieldCaptureAmount?: number;          // Present only on CLOSED phase
  alertFingerprint:    string;          // Idempotency key — mint once per rivalryId+phase
  publishedAt:         string;          // ISO
}

/**
 * Market Phase Bulletin — system message published into Deal Room and
 * Syndicate channels at every rivalry phase transition.
 *
 * Immutable once written. No unsend. Part of the official rivalry record.
 */
export interface MarketPhaseBulletin {
  bulletinId:  string;
  rivalryId:   string;
  phase:       RivalryPhase;
  channelId:   string;
  body:        string;          // Rendered bulletin copy
  publishedAt: string;          // ISO
  immutable:   true;            // Always true — transcript integrity
}

export interface ChatMessage {
  messageId:   string;
  channelId:   string;
  channelType: ChannelType;
  senderId:    string | 'SYSTEM';
  body:        string;
  metadata?:   Record<string, unknown>;
  createdAt:   Date;
  immutable:   boolean;
}

// ─── Market Phase Bulletin copy — financial voice ─────────────────────────────

/**
 * T194: Canonical Market Phase Bulletin copy per phase.
 * Published as SYSTEM messages at each rivalry phase transition.
 * Voice: declarative, proof-backed, pressure-driven.
 */
export const MARKET_PHASE_BULLETIN_COPY: Record<RivalryPhase, (challengerName: string, defenderName: string) => string> = {
  NOTICE_FILED: (c, d) =>
    `📋 RIVALRY NOTICE FILED — ${c} has filed a formal capital challenge against ${d}. Due Diligence window is open. Review your portfolio and activate your Market Plays before the CAPITAL_BATTLE window opens.`,

  DUE_DILIGENCE: (c, d) =>
    `🔍 DUE DILIGENCE PHASE ACTIVE — ${c} vs. ${d}. Capital Battle opens when this window closes. Final preparation window. No vibes — only verified moves count when the clock opens.`,

  CAPITAL_BATTLE: (c, d) =>
    `⚡ CAPITAL BATTLE OPEN — ${c} vs. ${d}. Qualifying runs are now scoring. Every verified cashflow move accrues Capital Score. The Market Clock is running. The platform tracks the line.`,

  LEDGER_CLOSE: (c, d) =>
    `⚖️ LEDGER CLOSE IN PROGRESS — ${c} vs. ${d}. Scoring window is frozen. Settlement Ceremony is executing. Yield Capture is being calculated. Outcome publishes with a Settlement Hash. Rivalries end in a record, not an argument.`,

  CLOSED: (c, d) =>
    `🏁 RIVALRY CLOSED — ${c} vs. ${d}. Settlement Hash published. Yield Capture transferred. Liquidity Shields activated for both Syndicates. Full Deal Recap Bundle is available in Rivalry History.`,
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IChatDatabase {
  getChannel(channelId: string): Promise<{ channelId: string; type: ChannelType; rivalryId?: string } | null>;
  getChannelsByRivalry(rivalryId: string): Promise<string[]>;
  getGlobalChannelIds(): Promise<string[]>;
  getServerChannelIds(shardId: string): Promise<string[]>;
  getSyndicateChannelIds(syndicateIds: string[]): Promise<string[]>;
  writeMessage(msg: ChatMessage): Promise<void>;
  existsAlertFingerprint(fingerprint: string): Promise<boolean>;
  writeAlertFingerprint(fingerprint: string): Promise<void>;
}

export interface IFanoutService {
  publish(channelIds: string[], payload: unknown): Promise<void>;
}

export interface IMetrics {
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  increment(name: string, tags?: Record<string, string>): void;
}

// ─── ChatService ──────────────────────────────────────────────────────────────

export class ChatService {
  /** Global broadcast quota: 100 Market Move Alerts per minute across all rivalries */
  private static readonly GLOBAL_BROADCAST_QUOTA_PER_MINUTE = 100;
  private globalBroadcastCount = 0;
  private quotaWindowStart     = Date.now();

  constructor(
    private readonly db:      IChatDatabase,
    private readonly fanout:  IFanoutService,
    private readonly metrics: IMetrics,
  ) {}

  // ── T194: Market Move Alert — mint once per rivalryId + phase ──────────────

  /**
   * T194: Publish Market Move Alert card.
   *
   * Minted once per rivalry phase — idempotent by alertFingerprint.
   * Safe to retry on worker restart. No duplicate broadcasts.
   * Published simultaneously to:
   *   - All GLOBAL channels
   *   - Both Syndicate channels
   *   - SERVER channel on the rivalry shard
   *
   * The platform can prove every alert was published and when.
   */
  async publishMarketMoveAlert(
    rivalryId:   string,
    phase:       RivalryPhase,
    challenger:  SyndicateBannerMeta,
    defender:    SyndicateBannerMeta,
    phaseEndsAt: Date,
    shardId:     string,
    proofHash?:  string,
    yieldCaptureAmount?: number,
  ): Promise<MarketMoveAlertPayload | null> {

    // Idempotency — mint once per rivalryId + phase
    const fingerprint = `market_move_alert:${rivalryId}:${phase}`;
    if (await this.db.existsAlertFingerprint(fingerprint)) return null;

    // Global broadcast quota guard
    const now = Date.now();
    if (now - this.quotaWindowStart > 60_000) {
      this.globalBroadcastCount = 0;
      this.quotaWindowStart     = now;
    }
    if (this.globalBroadcastCount >= ChatService.GLOBAL_BROADCAST_QUOTA_PER_MINUTE) {
      throw new Error('Global Market Move Alert quota exceeded — retry after 1 minute.');
    }

    const payload: MarketMoveAlertPayload = {
      rivalryId,
      phase,
      challenger,
      defender,
      phaseEndsAt:         phaseEndsAt.toISOString(),
      deepLink:            `/rivalries/${rivalryId}`,
      proofHash,
      yieldCaptureAmount,
      alertFingerprint:    fingerprint,
      publishedAt:         new Date().toISOString(),
    };

    // Resolve all channel targets in parallel
    const [globalIds, serverIds, syndicateIds] = await Promise.all([
      this.db.getGlobalChannelIds(),
      this.db.getServerChannelIds(shardId),
      this.db.getSyndicateChannelIds([challenger.syndicateId, defender.syndicateId]),
    ]);

    const allChannels = [...new Set([...globalIds, ...serverIds, ...syndicateIds])];
    const t0 = Date.now();
    await this.fanout.publish(allChannels, { type: 'MARKET_MOVE_ALERT', payload });

    // T194 telemetry
    this.metrics.histogram('market_move_alert_fanout_latency_ms', Date.now() - t0, { phase });
    this.metrics.increment('market_move_alert_published', { phase });

    await this.db.writeAlertFingerprint(fingerprint);
    this.globalBroadcastCount++;

    return payload;
  }

  // ── T194: Market Phase Bulletin — publish into Deal Room + Syndicate channels

  /**
   * Publish a Market Phase Bulletin (SYSTEM message) into Deal Room
   * and both Syndicate channels on every rivalry phase transition.
   *
   * Immutable — transcript integrity enforced. No unsend.
   * Part of the official rivalry record. The platform can prove what was said.
   */
  async publishMarketPhaseBulletin(
    rivalryId:       string,
    phase:           RivalryPhase,
    challengerName:  string,
    defenderName:    string,
  ): Promise<MarketPhaseBulletin[]> {
    const channelIds = await this.db.getChannelsByRivalry(rivalryId);
    const bulletins: MarketPhaseBulletin[] = [];
    const body        = MARKET_PHASE_BULLETIN_COPY[phase](challengerName, defenderName);
    const publishedAt = new Date();

    for (const channelId of channelIds) {
      const bulletinId = `bulletin:${rivalryId}:${phase}:${channelId}`;
      const msg: ChatMessage = {
        messageId:   bulletinId,
        channelId,
        channelType: 'DEAL_ROOM',
        senderId:    'SYSTEM',
        body,
        metadata:    { rivalryId, phase, bulletinType: 'MARKET_PHASE_BULLETIN' },
        createdAt:   publishedAt,
        immutable:   true,
      };

      await this.db.writeMessage(msg);
      this.metrics.increment('market_phase_bulletin_published', { phase });

      bulletins.push({
        bulletinId,
        rivalryId,
        phase,
        channelId,
        body,
        publishedAt: publishedAt.toISOString(),
        immutable:   true,
      });
    }

    return bulletins;
  }

  // ── T198: War Fanout Stress Protocol ──────────────────────────────────────

  /**
   * T198: War Fanout Stress Protocol.
   *
   * Simulates concurrent rivalry alert fanout at Syndicate scale.
   * Measures p50 / p95 / p99 latency across all broadcast paths.
   *
   * Staging-only — gated by RIVALRY_LOAD_TEST feature flag at router level.
   * Run this before every Deal Room + alert infrastructure change.
   */
  async runWarFanoutStressProtocol(params: {
    concurrentRivalries: number;
    syndicatesPerRivalry: number;
    alertsPerRivalry:    number;
  }): Promise<{
    totalAlerts:    number;
    successCount:   number;
    failureCount:   number;
    latencyMs:      { p50: number; p95: number; p99: number };
    channelsHit:    number;
    durationMs:     number;
  }> {
    const { concurrentRivalries, syndicatesPerRivalry, alertsPerRivalry } = params;
    const latencies: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    let channelsHit  = 0;
    const start      = Date.now();

    const rivalryJobs = Array.from({ length: concurrentRivalries }, async (_, ri) => {
      const mockSyndicateIds = Array.from({ length: syndicatesPerRivalry }, (__, si) =>
        `stress_syndicate_${ri}_${si}`
      );

      for (let ai = 0; ai < alertsPerRivalry; ai++) {
        const t0 = Date.now();
        try {
          const channelIds = await this.db.getSyndicateChannelIds(mockSyndicateIds);
          await this.fanout.publish(channelIds, {
            type: 'MARKET_MOVE_ALERT_STRESS',
            rivalryId: `stress_rivalry_${ri}`,
            alertIndex: ai,
          });
          latencies.push(Date.now() - t0);
          channelsHit += mockSyndicateIds.length;
          successCount++;
        } catch {
          failureCount++;
          latencies.push(Date.now() - t0);
        }
      }
    });

    await Promise.all(rivalryJobs);

    const sorted = [...latencies].sort((a, b) => a - b);
    const p = (pct: number) => sorted[Math.floor(sorted.length * pct)] ?? 0;

    const result = {
      totalAlerts:  successCount + failureCount,
      successCount,
      failureCount,
      latencyMs:    { p50: p(0.5), p95: p(0.95), p99: p(0.99) },
      channelsHit,
      durationMs:   Date.now() - start,
    };

    this.metrics.histogram('fanout_stress_p99_ms', result.latencyMs.p99);
    this.metrics.histogram('fanout_stress_p95_ms', result.latencyMs.p95);
    this.metrics.increment('fanout_stress_run');

    return result;
  }
}
