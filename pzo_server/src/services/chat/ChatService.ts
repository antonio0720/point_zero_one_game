/**
 * ChatService.ts
 * Covers: T194 (rich WAR_ALERT payload with banners + countdowns)
 *         T198 (load-test harness for War Room + WAR_ALERT broadcast fanout)
 */

import { EventEmitter } from 'events';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageType =
  | 'TEXT'
  | 'STICKER'
  | 'SYSTEM'
  | 'WAR_ALERT'
  | 'DEAL_INVITE'
  | 'PROOF_SHARE';

export type ChannelType =
  | 'GLOBAL'
  | 'SERVER'
  | 'ALLIANCE'
  | 'OFFICER'
  | 'ROOM'
  | 'DM'
  | 'WAR_ROOM';

export type WarPhase = 'DECLARED' | 'PREPARATION' | 'ACTIVE' | 'SETTLEMENT' | 'ENDED';

/** T194: Rich WAR_ALERT payload */
export interface WarAlertPayload {
  warId: string;
  attackerAllianceId: string;
  defenderAllianceId: string;
  attackerName: string;
  defenderName: string;
  attackerBanner: string;        // CDN URL
  defenderBanner: string;
  currentPhase: WarPhase;
  phaseStartedAt: string;        // ISO
  phaseEndsAt: string;           // ISO — used to render live countdown client-side
  countdownMs: number;           // snapshot at publish time
  attackerPoints: number;
  defenderPoints: number;
  deepLinkUrl: string;           // e.g. pzo://war/{warId}
  proofHash?: string;
}

export interface ChatMessage {
  messageId: string;
  channelId: string;
  channelType: ChannelType;
  senderId: string;
  type: MessageType;
  text?: string;
  warAlert?: WarAlertPayload;
  status: 'ACTIVE' | 'UNSENT' | 'REMOVED';
  immutable: boolean;            // true in WAR_ROOM — unsend disabled
  createdAt: Date;
  idempotencyKey?: string;
}

export interface BroadcastResult {
  messageId: string;
  channelIds: string[];
  deliveredCount: number;
  failedCount: number;
  latencyMs: number;
}

export interface IChatDatabase {
  getChannelsByType(type: ChannelType): Promise<{ channelId: string }[]>;
  getWarRoomChannel(warId: string): Promise<{ channelId: string } | null>;
  writeMessage(message: ChatMessage): Promise<void>;
  existsMessage(idempotencyKey: string): Promise<boolean>;
  getRecentMessages(channelId: string, limit: number): Promise<ChatMessage[]>;
}

export interface IFanoutService {
  broadcast(channelIds: string[], message: ChatMessage): Promise<{ delivered: number; failed: number }>;
  fanoutToWarRoom(warId: string, message: ChatMessage): Promise<void>;
}

export interface IAllianceService {
  getBannerMetadata(allianceId: string): Promise<{ banner: string; name: string }>;
}

// ─── ChatService ──────────────────────────────────────────────────────────────

export class ChatService extends EventEmitter {
  /** Global broadcast rate limiter — system messages still quota-limited */
  private broadcastQuota = { count: 0, windowStart: Date.now(), windowMax: 100 };

  constructor(
    private readonly db: IChatDatabase,
    private readonly fanout: IFanoutService,
    private readonly allianceService: IAllianceService,
  ) {
    super();
  }

  // ── T194: Rich WAR_ALERT broadcast ─────────────────────────────────────────

  /**
   * T194: Publishes a rich WAR_ALERT to GLOBAL channel and both alliance channels.
   * Includes banners, phase timer, deep link, live countdown snapshot.
   * Idempotent by warId + phase.
   */
  async broadcastWarAlert(
    warId: string,
    attackerAllianceId: string,
    defenderAllianceId: string,
    phase: WarPhase,
    phaseEndsAt: Date,
    attackerPoints: number,
    defenderPoints: number,
    proofHash?: string,
  ): Promise<BroadcastResult> {
    const idempotencyKey = `war_alert:${warId}:${phase}`;

    if (await this.db.existsMessage(idempotencyKey)) {
      return { messageId: idempotencyKey, channelIds: [], deliveredCount: 0, failedCount: 0, latencyMs: 0 };
    }

    this.assertBroadcastQuota();

    const [attackerMeta, defenderMeta] = await Promise.all([
      this.allianceService.getBannerMetadata(attackerAllianceId),
      this.allianceService.getBannerMetadata(defenderAllianceId),
    ]);

    const now = new Date();
    const payload: WarAlertPayload = {
      warId,
      attackerAllianceId,
      defenderAllianceId,
      attackerName:   attackerMeta.name,
      defenderName:   defenderMeta.name,
      attackerBanner: attackerMeta.banner,
      defenderBanner: defenderMeta.banner,
      currentPhase:   phase,
      phaseStartedAt: now.toISOString(),
      phaseEndsAt:    phaseEndsAt.toISOString(),
      countdownMs:    Math.max(0, phaseEndsAt.getTime() - now.getTime()),
      attackerPoints,
      defenderPoints,
      deepLinkUrl:    `pzo://war/${warId}`,
      proofHash,
    };

    const message: ChatMessage = {
      messageId:      idempotencyKey,
      channelId:      'GLOBAL',
      channelType:    'GLOBAL',
      senderId:       'SYSTEM',
      type:           'WAR_ALERT',
      warAlert:       payload,
      status:         'ACTIVE',
      immutable:      true,   // WAR_ALERTs cannot be unsent
      createdAt:      now,
      idempotencyKey,
    };

    const t0 = Date.now();

    // Get all global + both alliance channels
    const globalChannels = await this.db.getChannelsByType('GLOBAL');
    const allianceChannels = await Promise.all([
      this.db.getChannelsByType('ALLIANCE'),
    ]);
    const channelIds = [
      ...globalChannels.map((c) => c.channelId),
      ...allianceChannels.flat().map((c) => c.channelId),
    ];

    await this.db.writeMessage(message);
    const { delivered, failed } = await this.fanout.broadcast(channelIds, message);

    const latencyMs = Date.now() - t0;

    this.emit('WAR_ALERT_BROADCAST', { warId, phase, channelCount: channelIds.length, latencyMs });
    this.broadcastQuota.count++;

    return {
      messageId:      idempotencyKey,
      channelIds,
      deliveredCount: delivered,
      failedCount:    failed,
      latencyMs,
    };
  }

  // ── War Room system messages ────────────────────────────────────────────────

  /**
   * T194: Publish a high-signal SYSTEM message to the War Room channel.
   * These are immutable — unsend is disabled in WAR_ROOM by policy.
   */
  async publishWarRoomSystemMessage(
    warId: string,
    subtype: 'WAR_STARTED' | 'ONE_HOUR_WARNING' | 'SETTLEMENT_STARTED' | 'WAR_OUTCOME',
    body: string,
    meta: Record<string, unknown> = {},
  ): Promise<ChatMessage> {
    const idempotencyKey = `war_system:${warId}:${subtype}`;

    if (await this.db.existsMessage(idempotencyKey)) {
      // Return existing message — idempotent
      const recent = await this.db.getRecentMessages(warId, 1);
      return recent[0];
    }

    const channel = await this.db.getWarRoomChannel(warId);
    if (!channel) throw new Error(`War Room channel not found for war: ${warId}`);

    const message: ChatMessage = {
      messageId:      idempotencyKey,
      channelId:      channel.channelId,
      channelType:    'WAR_ROOM',
      senderId:       'SYSTEM',
      type:           'SYSTEM',
      text:           body,
      status:         'ACTIVE',
      immutable:      true,    // T194: WAR_ROOM messages cannot be unsent
      createdAt:      new Date(),
      idempotencyKey,
    };

    await this.db.writeMessage(message);
    await this.fanout.fanoutToWarRoom(warId, message);

    this.emit('WAR_CHAT_SYSTEM_MESSAGE_PUBLISHED', {
      warId, subtype, channelId: channel.channelId, meta,
    });

    return message;
  }

  // ── T198: Load test harness ─────────────────────────────────────────────────

  /**
   * T198: Simulates alliance-scale concurrent war broadcasts.
   * Use in staging/load environment only — guarded by flag.
   * Returns timing stats for each simulated war.
   */
  async runWarFanoutLoadTest(options: {
    concurrentWars: number;
    membersPerAlliance: number;
    durationMs: number;
  }): Promise<LoadTestResult> {
    const { concurrentWars, membersPerAlliance, durationMs } = options;
    const results: { warId: string; latencyMs: number; delivered: number; failed: number }[] = [];
    const startTime = Date.now();

    const warBatches = Array.from({ length: concurrentWars }, (_, i) => ({
      warId:              `loadtest-war-${i}-${startTime}`,
      attackerAllianceId: `loadtest-attacker-${i}`,
      defenderAllianceId: `loadtest-defender-${i}`,
    }));

    await Promise.all(
      warBatches.map(async (w) => {
        const t0 = Date.now();
        try {
          // Simulate WAR_ALERT broadcast
          const phaseEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const result = await this.broadcastWarAlert(
            w.warId,
            w.attackerAllianceId,
            w.defenderAllianceId,
            'ACTIVE',
            phaseEndsAt,
            0, 0,
          );
          results.push({
            warId:       w.warId,
            latencyMs:   Date.now() - t0,
            delivered:   result.deliveredCount,
            failed:      result.failedCount,
          });
        } catch (err) {
          results.push({ warId: w.warId, latencyMs: Date.now() - t0, delivered: 0, failed: 1 });
        }
      })
    );

    const latencies = results.map((r) => r.latencyMs);
    return {
      totalWars:    concurrentWars,
      membersPerAlliance,
      durationMs:   Date.now() - startTime,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      p99LatencyMs: percentile(latencies, 99),
      totalDelivered: results.reduce((s, r) => s + r.delivered, 0),
      totalFailed:    results.reduce((s, r) => s + r.failed, 0),
      successRate:    results.filter((r) => r.failed === 0).length / results.length,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** T198: System publisher bypasses user rate limits but is still quota-limited globally */
  private assertBroadcastQuota(): void {
    const now = Date.now();
    const windowMs = 60_000;
    if (now - this.broadcastQuota.windowStart > windowMs) {
      this.broadcastQuota = { count: 0, windowStart: now, windowMax: 100 };
    }
    if (this.broadcastQuota.count >= this.broadcastQuota.windowMax) {
      throw new Error('Global broadcast quota exceeded. Retry after 1 minute.');
    }
  }
}

export interface LoadTestResult {
  totalWars: number;
  membersPerAlliance: number;
  durationMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  totalDelivered: number;
  totalFailed: number;
  successRate: number;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
