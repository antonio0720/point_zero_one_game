/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SEASONAL + LIVEOPS OVERLAY SERVICE
 * FILE: backend/src/game/engine/chat/intelligence/ChatSeasonalLiveOpsOverlayService.ts
 * VERSION: 2026.03.21-liveops-overlay-service.15x
 * AUTHORSHIP: Antonio T. Smith Jr. / OpenAI collaborative implementation
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend authority surface for seasonal + liveops chat overlays.
 *
 * The frontend runtime already owns deterministic activation + projection of
 * authored overlays. This backend service keeps that runtime intact, then wraps
 * it with the missing authority concerns:
 *
 * - authoritative registry and indexing
 * - mutation journal and replayability
 * - deterministic rebuilds after destructive mutations
 * - query / diagnostics / summary APIs for planners and operators
 * - NDJSON import/export for portability
 * - planning-hint aggregation for backend chat orchestration
 *
 * Design doctrine
 * ---------------
 * - Do not fork overlay truth away from the shared contract.
 * - Do not replace the frontend overlay projector unless the shared contract
 *   changes; reuse it so client and backend rank the same authored overlays.
 * - Keep every public import used.
 * - Keep outputs frozen / clone-safe where it matters.
 * ============================================================================
 */

import type {
  ChatLiveOpsChannelId,
  ChatLiveOpsIntensityBand,
  ChatLiveOpsOverlayContext,
  ChatLiveOpsOverlayDefinition,
  ChatLiveOpsOverlayKind,
  ChatLiveOpsOverlaySnapshot,
} from '../../../../../../shared/contracts/chat/liveops';
import {
  ChatSeasonalLiveOpsOverlay,
  type ChatSeasonalOverlayResolveRequest,
} from '../../../../../../pzo-web/src/engines/chat/intelligence/ChatSeasonalLiveOpsOverlay';

// ============================================================================
// MARK: Constants
// ============================================================================

export const CHAT_SEASONAL_LIVEOPS_OVERLAY_SERVICE_VERSION =
  '2026.03.21-liveops-overlay-service.15x';

const LIVEOPS_CHANNEL_IDS: readonly ChatLiveOpsChannelId[] = Object.freeze([
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
]);

const LIVEOPS_INTENSITY_BANDS: readonly ChatLiveOpsIntensityBand[] = Object.freeze([
  'QUIET',
  'ACTIVE',
  'SEVERE',
  'WORLD_CLASS',
]);

const LIVEOPS_OVERLAY_KINDS: readonly ChatLiveOpsOverlayKind[] = Object.freeze([
  'SEASON',
  'WORLD_EVENT',
  'LIMITED_INTRUSION',
  'RIVAL_SPOTLIGHT',
  'HELPER_PUSH',
  'PUBLIC_WITNESS_SWELL',
]);

const DEFAULT_JOURNAL_LIMIT = 4096;
const DEFAULT_QUERY_LIMIT = 256;
const DEFAULT_RESOLUTION_BATCH_LIMIT = 64;

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ChatSeasonalLiveOpsOverlayMutationAction =
  | 'UPSERT'
  | 'UPSERT_MANY'
  | 'REMOVE'
  | 'REMOVE_MANY'
  | 'REPLACE_ALL'
  | 'CLEAR'
  | 'PRUNE_EXPIRED'
  | 'HYDRATE'
  | 'IMPORT_NDJSON';

export type ChatSeasonalLiveOpsOverlayWindowState =
  | 'UPCOMING'
  | 'ACTIVE'
  | 'EXPIRED';

export interface ChatSeasonalLiveOpsOverlayServiceOptions {
  readonly now?: () => number;
  readonly journalLimit?: number;
}

export interface ChatSeasonalLiveOpsOverlayServiceResolveRequest
  extends ChatSeasonalOverlayResolveRequest {}

export interface ChatSeasonalLiveOpsOverlayRecord {
  readonly overlayId: string;
  readonly definition: ChatLiveOpsOverlayDefinition;
  readonly revision: number;
  readonly insertedAt: number;
  readonly updatedAt: number;
  readonly mutationCount: number;
  readonly source: string;
}

export interface ChatSeasonalLiveOpsOverlayMutation {
  readonly sequence: number;
  readonly action: ChatSeasonalLiveOpsOverlayMutationAction;
  readonly at: number;
  readonly overlayIds: readonly string[];
  readonly source: string;
  readonly note?: string;
  readonly registrySizeAfter: number;
}

export interface ChatSeasonalLiveOpsOverlayWindow {
  readonly overlayId: string;
  readonly state: ChatSeasonalLiveOpsOverlayWindowState;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly durationMs: number;
  readonly msUntilStart: number;
  readonly msUntilEnd: number;
  readonly isActive: boolean;
  readonly isUpcoming: boolean;
  readonly isExpired: boolean;
}

export interface ChatSeasonalLiveOpsOverlayQuery {
  readonly overlayIds?: readonly string[];
  readonly seasonId?: string | null;
  readonly kind?: ChatLiveOpsOverlayKind;
  readonly kinds?: readonly ChatLiveOpsOverlayKind[];
  readonly intensity?: ChatLiveOpsIntensityBand;
  readonly intensities?: readonly ChatLiveOpsIntensityBand[];
  readonly channelId?: ChatLiveOpsChannelId;
  readonly tagsAny?: readonly string[];
  readonly tagsAll?: readonly string[];
  readonly activeAt?: number;
  readonly includeExpired?: boolean;
  readonly text?: string;
  readonly limit?: number;
}

export interface ChatSeasonalLiveOpsOverlayResolution {
  readonly rank: number;
  readonly score: number;
  readonly context: ChatLiveOpsOverlayContext;
  readonly definition: ChatLiveOpsOverlayDefinition;
  readonly channelPriority: number;
  readonly window: ChatSeasonalLiveOpsOverlayWindow;
}

export interface ChatSeasonalLiveOpsOverlayPlanningHints {
  readonly now: number;
  readonly channelId: ChatLiveOpsChannelId;
  readonly botId?: string | null;
  readonly tags: readonly string[];
  readonly activeOverlayIds: readonly string[];
  readonly activeSeasonId?: string | null;
  readonly dominantOverlayId?: string | null;
  readonly dominantKind?: ChatLiveOpsOverlayKind | null;
  readonly dominantIntensity?: ChatLiveOpsIntensityBand | null;
  readonly transformBiases: readonly string[];
  readonly planningTags: readonly string[];
  readonly headlines: readonly string[];
  readonly notes: readonly string[];
  readonly pressureDelta: number;
  readonly publicnessDelta: number;
  readonly callbackAggressionDelta: number;
  readonly topScore: number;
  readonly activeCount: number;
}

export interface ChatSeasonalLiveOpsOverlayServiceStats {
  readonly totalDefinitions: number;
  readonly activeDefinitions: number;
  readonly upcomingDefinitions: number;
  readonly expiredDefinitions: number;
  readonly seasonsTracked: number;
  readonly tagCount: number;
  readonly journalSize: number;
  readonly byKind: Readonly<Record<ChatLiveOpsOverlayKind, number>>;
  readonly byIntensity: Readonly<Record<ChatLiveOpsIntensityBand, number>>;
  readonly activeByChannel: Readonly<Record<ChatLiveOpsChannelId, number>>;
}

export interface ChatSeasonalLiveOpsOverlayServiceSnapshot {
  readonly version: string;
  readonly generatedAt: number;
  readonly runtime: ChatLiveOpsOverlaySnapshot;
  readonly stats: ChatSeasonalLiveOpsOverlayServiceStats;
  readonly recentMutations: readonly ChatSeasonalLiveOpsOverlayMutation[];
  readonly definitions: readonly ChatSeasonalLiveOpsOverlayRecord[];
}

export interface ChatSeasonalLiveOpsOverlayServiceManifest {
  readonly version: string;
  readonly totalDefinitions: number;
  readonly totalSeasons: number;
  readonly totalTags: number;
  readonly activeSeasonId?: string | null;
  readonly activeHeadline?: string | null;
  readonly kinds: readonly ChatLiveOpsOverlayKind[];
  readonly intensities: readonly ChatLiveOpsIntensityBand[];
  readonly channels: readonly ChatLiveOpsChannelId[];
}

export interface ChatSeasonalLiveOpsOverlayImportResult {
  readonly imported: number;
  readonly rejected: number;
  readonly errors: readonly string[];
}

// ============================================================================
// MARK: Service
// ============================================================================

export class ChatSeasonalLiveOpsOverlayService {
  private runtime: ChatSeasonalLiveOpsOverlay;

  private readonly records = new Map<string, ChatSeasonalLiveOpsOverlayRecord>();
  private readonly seasonIndex = new Map<string, Set<string>>();
  private readonly kindIndex = new Map<ChatLiveOpsOverlayKind, Set<string>>();
  private readonly intensityIndex = new Map<ChatLiveOpsIntensityBand, Set<string>>();
  private readonly channelIndex = new Map<ChatLiveOpsChannelId, Set<string>>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly journal: ChatSeasonalLiveOpsOverlayMutation[] = [];

  private readonly now: () => number;
  private readonly journalLimit: number;
  private mutationSequence = 0;

  constructor(options: ChatSeasonalLiveOpsOverlayServiceOptions = {}) {
    this.runtime = new ChatSeasonalLiveOpsOverlay();
    this.now = options.now ?? (() => Date.now());
    this.journalLimit = sanitizePositiveInteger(
      options.journalLimit,
      DEFAULT_JOURNAL_LIMIT,
    );

    for (const kind of LIVEOPS_OVERLAY_KINDS) {
      this.kindIndex.set(kind, new Set<string>());
    }

    for (const intensity of LIVEOPS_INTENSITY_BANDS) {
      this.intensityIndex.set(intensity, new Set<string>());
    }

    for (const channelId of LIVEOPS_CHANNEL_IDS) {
      this.channelIndex.set(channelId, new Set<string>());
    }
  }

  // ========================================================================
  // MARK: Authoritative writes
  // ========================================================================

  upsert(definition: ChatLiveOpsOverlayDefinition): void {
    const now = this.now();
    const normalized = normalizeOverlayDefinition(definition);
    const previous = this.records.get(normalized.overlayId);

    if (previous) {
      this.detachIndexes(previous);
    }

    const record = createOverlayRecord(normalized, previous, now, 'manual');
    this.records.set(normalized.overlayId, record);
    this.attachIndexes(record);
    this.runtime.upsert(record.definition);

    this.pushMutation({
      action: 'UPSERT',
      at: now,
      overlayIds: Object.freeze([normalized.overlayId]),
      source: 'manual',
      registrySizeAfter: this.records.size,
    });
  }

  upsertMany(definitions: readonly ChatLiveOpsOverlayDefinition[]): void {
    if (definitions.length === 0) {
      return;
    }

    const now = this.now();
    const touched = new Set<string>();

    for (const definition of definitions) {
      const normalized = normalizeOverlayDefinition(definition);
      const previous = this.records.get(normalized.overlayId);
      if (previous) {
        this.detachIndexes(previous);
      }

      const record = createOverlayRecord(normalized, previous, now, 'batch');
      this.records.set(normalized.overlayId, record);
      this.attachIndexes(record);
      this.runtime.upsert(record.definition);
      touched.add(record.overlayId);
    }

    this.pushMutation({
      action: 'UPSERT_MANY',
      at: now,
      overlayIds: Object.freeze([...touched].sort()),
      source: 'batch',
      registrySizeAfter: this.records.size,
    });
  }

  replaceAll(definitions: readonly ChatLiveOpsOverlayDefinition[]): void {
    const now = this.now();
    this.records.clear();
    this.clearIndexesOnly();

    for (const definition of definitions) {
      const normalized = normalizeOverlayDefinition(definition);
      const record = createOverlayRecord(normalized, undefined, now, 'replaceAll');
      this.records.set(record.overlayId, record);
      this.attachIndexes(record);
    }

    this.rebuildRuntime();
    this.pushMutation({
      action: 'REPLACE_ALL',
      at: now,
      overlayIds: Object.freeze([...this.records.keys()].sort()),
      source: 'replaceAll',
      registrySizeAfter: this.records.size,
    });
  }

  hydrate(definitions: readonly ChatLiveOpsOverlayDefinition[]): void {
    if (definitions.length === 0) {
      return;
    }

    const now = this.now();
    const touched: string[] = [];

    for (const definition of definitions) {
      const normalized = normalizeOverlayDefinition(definition);
      const previous = this.records.get(normalized.overlayId);
      if (previous) {
        this.detachIndexes(previous);
      }

      const record = createOverlayRecord(normalized, previous, now, 'hydrate');
      this.records.set(record.overlayId, record);
      this.attachIndexes(record);
      touched.push(record.overlayId);
    }

    this.rebuildRuntime();
    this.pushMutation({
      action: 'HYDRATE',
      at: now,
      overlayIds: Object.freeze(touched.sort()),
      source: 'hydrate',
      registrySizeAfter: this.records.size,
    });
  }

  remove(overlayId: string): boolean {
    const existing = this.records.get(overlayId);
    if (!existing) {
      return false;
    }

    this.records.delete(overlayId);
    this.detachIndexes(existing);
    this.rebuildRuntime();

    this.pushMutation({
      action: 'REMOVE',
      at: this.now(),
      overlayIds: Object.freeze([overlayId]),
      source: 'manual',
      registrySizeAfter: this.records.size,
    });

    return true;
  }

  removeMany(overlayIds: readonly string[]): number {
    if (overlayIds.length === 0) {
      return 0;
    }

    const removed: string[] = [];
    for (const overlayId of overlayIds) {
      const existing = this.records.get(overlayId);
      if (!existing) {
        continue;
      }

      this.records.delete(overlayId);
      this.detachIndexes(existing);
      removed.push(overlayId);
    }

    if (removed.length === 0) {
      return 0;
    }

    this.rebuildRuntime();
    this.pushMutation({
      action: 'REMOVE_MANY',
      at: this.now(),
      overlayIds: Object.freeze(removed.sort()),
      source: 'manual',
      registrySizeAfter: this.records.size,
    });

    return removed.length;
  }

  clear(): void {
    if (this.records.size === 0) {
      return;
    }

    this.records.clear();
    this.clearIndexesOnly();
    this.rebuildRuntime();

    this.pushMutation({
      action: 'CLEAR',
      at: this.now(),
      overlayIds: Object.freeze([]),
      source: 'manual',
      registrySizeAfter: 0,
    });
  }

  pruneExpired(now = this.now()): number {
    const expired: string[] = [];
    for (const record of this.records.values()) {
      if (record.definition.endsAt < now) {
        expired.push(record.overlayId);
      }
    }

    if (expired.length === 0) {
      return 0;
    }

    for (const overlayId of expired) {
      const existing = this.records.get(overlayId);
      if (!existing) {
        continue;
      }
      this.records.delete(overlayId);
      this.detachIndexes(existing);
    }

    this.rebuildRuntime();
    this.pushMutation({
      action: 'PRUNE_EXPIRED',
      at: now,
      overlayIds: Object.freeze(expired.sort()),
      source: 'system',
      registrySizeAfter: this.records.size,
    });

    return expired.length;
  }

  importNdjson(lines: readonly string[]): ChatSeasonalLiveOpsOverlayImportResult {
    const parsed: ChatLiveOpsOverlayDefinition[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        return;
      }

      try {
        const value = JSON.parse(trimmed) as ChatLiveOpsOverlayDefinition;
        parsed.push(normalizeOverlayDefinition(value));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`line:${index + 1}:${message}`);
      }
    });

    if (parsed.length > 0) {
      this.hydrate(parsed);
      this.pushMutation({
        action: 'IMPORT_NDJSON',
        at: this.now(),
        overlayIds: Object.freeze(parsed.map((entry) => entry.overlayId).sort()),
        source: 'ndjson',
        registrySizeAfter: this.records.size,
        note: `imported:${parsed.length};rejected:${errors.length}`,
      });
    }

    return Object.freeze({
      imported: parsed.length,
      rejected: errors.length,
      errors: Object.freeze(errors),
    });
  }

  exportNdjson(query?: ChatSeasonalLiveOpsOverlayQuery): readonly string[] {
    return Object.freeze(
      this.listDefinitions(query).map((definition) => JSON.stringify(definition)),
    );
  }

  // ========================================================================
  // MARK: Reads / queries
  // ========================================================================

  has(overlayId: string): boolean {
    return this.records.has(overlayId);
  }

  getDefinition(overlayId: string): ChatLiveOpsOverlayDefinition | null {
    const record = this.records.get(overlayId);
    return record ? cloneOverlayDefinition(record.definition) : null;
  }

  getRecord(overlayId: string): ChatSeasonalLiveOpsOverlayRecord | null {
    const record = this.records.get(overlayId);
    return record ? cloneOverlayRecord(record) : null;
  }

  size(): number {
    return this.records.size;
  }

  listDefinitions(
    query: ChatSeasonalLiveOpsOverlayQuery = {},
  ): readonly ChatLiveOpsOverlayDefinition[] {
    return Object.freeze(
      this.queryRecords(query).map((record) => cloneOverlayDefinition(record.definition)),
    );
  }

  listRecords(
    query: ChatSeasonalLiveOpsOverlayQuery = {},
  ): readonly ChatSeasonalLiveOpsOverlayRecord[] {
    return Object.freeze(this.queryRecords(query).map(cloneOverlayRecord));
  }

  listActive(now = this.now()): readonly ChatLiveOpsOverlayDefinition[] {
    return this.listDefinitions({ activeAt: now, includeExpired: false });
  }

  listUpcoming(
    now = this.now(),
    limit = 12,
  ): readonly ChatLiveOpsOverlayDefinition[] {
    const normalizedLimit = sanitizePositiveInteger(limit, 12);
    const upcoming = [...this.records.values()]
      .filter((record) => record.definition.startsAt > now)
      .sort(compareOverlayRecordsBySchedule)
      .slice(0, normalizedLimit)
      .map((record) => cloneOverlayDefinition(record.definition));

    return Object.freeze(upcoming);
  }

  listBySeason(seasonId: string): readonly ChatLiveOpsOverlayDefinition[] {
    return this.listDefinitions({ seasonId });
  }

  listByTag(tag: string): readonly ChatLiveOpsOverlayDefinition[] {
    return this.listDefinitions({ tagsAny: Object.freeze([tag]) });
  }

  listByChannel(channelId: ChatLiveOpsChannelId): readonly ChatLiveOpsOverlayDefinition[] {
    return this.listDefinitions({ channelId });
  }

  getWindow(
    overlayId: string,
    now = this.now(),
  ): ChatSeasonalLiveOpsOverlayWindow | null {
    const record = this.records.get(overlayId);
    if (!record) {
      return null;
    }
    return freezeWindow(createOverlayWindow(record.definition, now));
  }

  getActiveSeasonId(now = this.now()): string | null {
    const runtimeSnapshot = this.getSnapshot(now);
    return runtimeSnapshot.activeSeasonId ?? null;
  }

  // ========================================================================
  // MARK: Context resolution
  // ========================================================================

  resolveContext(
    input: ChatSeasonalLiveOpsOverlayServiceResolveRequest,
  ): readonly ChatLiveOpsOverlayContext[] {
    const request: ChatSeasonalOverlayResolveRequest = {
      now: input.now,
      channelId: input.channelId,
      botId: input.botId ?? null,
      tags: input.tags ? Object.freeze([...input.tags]) : undefined,
    };

    return Object.freeze(
      this.runtime.resolveContext(request).map((context) => cloneOverlayContext(context)),
    );
  }

  resolveDetailed(
    input: ChatSeasonalLiveOpsOverlayServiceResolveRequest,
  ): readonly ChatSeasonalLiveOpsOverlayResolution[] {
    const contexts = this.resolveContext(input);
    const detailed = contexts
      .map((context, index) => {
        const record = this.records.get(context.overlayId);
        if (!record) {
          return null;
        }

        const score = scoreResolvedOverlay(context);
        const channelPriority = record.definition.channelPriority[input.channelId] ?? 0;
        const window = createOverlayWindow(record.definition, input.now);

        return Object.freeze({
          rank: index + 1,
          score,
          context: cloneOverlayContext(context),
          definition: cloneOverlayDefinition(record.definition),
          channelPriority,
          window: freezeWindow(window),
        }) satisfies ChatSeasonalLiveOpsOverlayResolution;
      })
      .filter(
        (
          value,
        ): value is ChatSeasonalLiveOpsOverlayResolution => value !== null,
      );

    return Object.freeze(detailed);
  }

  resolvePlanningHints(
    input: ChatSeasonalLiveOpsOverlayServiceResolveRequest,
  ): ChatSeasonalLiveOpsOverlayPlanningHints {
    const resolutions = this.resolveDetailed(input);
    const transformBiases = new Set<string>();
    const planningTags = new Set<string>();
    const headlines: string[] = [];
    const notes: string[] = [];

    let pressureDelta = 0;
    let publicnessDelta = 0;
    let callbackAggressionDelta = 0;

    for (const resolution of resolutions) {
      headlines.push(resolution.context.headline);
      for (const bias of resolution.context.transformBiases) {
        transformBiases.add(bias);
      }
      for (const note of resolution.context.notes) {
        notes.push(note);
        if (note.startsWith('tag:')) {
          planningTags.add(note.slice(4));
        }
      }

      pressureDelta = clamp01(pressureDelta + resolution.context.pressureDelta);
      publicnessDelta = clamp01(
        publicnessDelta + resolution.context.publicnessDelta,
      );
      callbackAggressionDelta = clamp01(
        callbackAggressionDelta + resolution.context.callbackAggressionDelta,
      );
    }

    const dominant = resolutions[0] ?? null;
    const runtimeSnapshot = this.getSnapshot(input.now);

    return Object.freeze({
      now: input.now,
      channelId: input.channelId,
      botId: input.botId ?? null,
      tags: Object.freeze([...(input.tags ?? [])]),
      activeOverlayIds: Object.freeze(resolutions.map((entry) => entry.context.overlayId)),
      activeSeasonId: runtimeSnapshot.activeSeasonId ?? null,
      dominantOverlayId: dominant?.context.overlayId ?? null,
      dominantKind: dominant?.context.kind ?? null,
      dominantIntensity: dominant?.context.intensity ?? null,
      transformBiases: Object.freeze([...transformBiases]),
      planningTags: Object.freeze([...planningTags]),
      headlines: Object.freeze(headlines),
      notes: Object.freeze(notes),
      pressureDelta,
      publicnessDelta,
      callbackAggressionDelta,
      topScore: dominant?.score ?? 0,
      activeCount: resolutions.length,
    });
  }

  resolveAcrossChannels(input: {
    readonly now: number;
    readonly channels: readonly ChatLiveOpsChannelId[];
    readonly botId?: string | null;
    readonly tags?: readonly string[];
    readonly limitPerChannel?: number;
  }): Readonly<Record<ChatLiveOpsChannelId, readonly ChatSeasonalLiveOpsOverlayResolution[]>> {
    const limitPerChannel = sanitizePositiveInteger(
      input.limitPerChannel,
      DEFAULT_RESOLUTION_BATCH_LIMIT,
    );

    const results: Record<ChatLiveOpsChannelId, readonly ChatSeasonalLiveOpsOverlayResolution[]> = {
      GLOBAL: Object.freeze([]),
      SYNDICATE: Object.freeze([]),
      DEAL_ROOM: Object.freeze([]),
      LOBBY: Object.freeze([]),
    };

    for (const channelId of input.channels) {
      results[channelId] = Object.freeze(
        this.resolveDetailed({
          now: input.now,
          channelId,
          botId: input.botId ?? null,
          tags: input.tags,
        }).slice(0, limitPerChannel),
      );
    }

    return Object.freeze(results);
  }

  // ========================================================================
  // MARK: Snapshots / diagnostics / manifests
  // ========================================================================

  getSnapshot(now = this.now()): ChatLiveOpsOverlaySnapshot {
    const snapshot = this.runtime.getSnapshot(now);
    return Object.freeze({
      updatedAt: snapshot.updatedAt,
      activeSeasonId: snapshot.activeSeasonId ?? null,
      activeOverlays: Object.freeze(
        snapshot.activeOverlays.map((definition) => cloneOverlayDefinition(definition)),
      ),
      upcomingOverlays: Object.freeze(
        snapshot.upcomingOverlays.map((definition) => cloneOverlayDefinition(definition)),
      ),
    });
  }

  getStats(now = this.now()): ChatSeasonalLiveOpsOverlayServiceStats {
    const totalDefinitions = this.records.size;

    let activeDefinitions = 0;
    let upcomingDefinitions = 0;
    let expiredDefinitions = 0;

    const byKind: Record<ChatLiveOpsOverlayKind, number> = {
      SEASON: 0,
      WORLD_EVENT: 0,
      LIMITED_INTRUSION: 0,
      RIVAL_SPOTLIGHT: 0,
      HELPER_PUSH: 0,
      PUBLIC_WITNESS_SWELL: 0,
    };

    const byIntensity: Record<ChatLiveOpsIntensityBand, number> = {
      QUIET: 0,
      ACTIVE: 0,
      SEVERE: 0,
      WORLD_CLASS: 0,
    };

    const activeByChannel: Record<ChatLiveOpsChannelId, number> = {
      GLOBAL: 0,
      SYNDICATE: 0,
      DEAL_ROOM: 0,
      LOBBY: 0,
    };

    for (const record of this.records.values()) {
      byKind[record.definition.kind] += 1;
      byIntensity[record.definition.intensity] += 1;

      const window = createOverlayWindow(record.definition, now);
      if (window.isActive) {
        activeDefinitions += 1;
        for (const channelId of LIVEOPS_CHANNEL_IDS) {
          if ((record.definition.channelPriority[channelId] ?? 0) > 0) {
            activeByChannel[channelId] += 1;
          }
        }
      } else if (window.isUpcoming) {
        upcomingDefinitions += 1;
      } else {
        expiredDefinitions += 1;
      }
    }

    return Object.freeze({
      totalDefinitions,
      activeDefinitions,
      upcomingDefinitions,
      expiredDefinitions,
      seasonsTracked: this.seasonIndex.size,
      tagCount: this.tagIndex.size,
      journalSize: this.journal.length,
      byKind: Object.freeze({ ...byKind }),
      byIntensity: Object.freeze({ ...byIntensity }),
      activeByChannel: Object.freeze({ ...activeByChannel }),
    });
  }

  getServiceSnapshot(
    now = this.now(),
    options: { readonly recentMutationLimit?: number } = {},
  ): ChatSeasonalLiveOpsOverlayServiceSnapshot {
    const recentMutationLimit = sanitizePositiveInteger(
      options.recentMutationLimit,
      48,
    );

    const definitions = [...this.records.values()]
      .sort(compareOverlayRecordsBySchedule)
      .map(cloneOverlayRecord);

    return Object.freeze({
      version: CHAT_SEASONAL_LIVEOPS_OVERLAY_SERVICE_VERSION,
      generatedAt: now,
      runtime: this.getSnapshot(now),
      stats: this.getStats(now),
      recentMutations: Object.freeze(
        this.journal.slice(-recentMutationLimit).map(cloneMutation),
      ),
      definitions: Object.freeze(definitions),
    });
  }

  exportManifest(now = this.now()): ChatSeasonalLiveOpsOverlayServiceManifest {
    const runtimeSnapshot = this.getSnapshot(now);
    const activeHeadline = runtimeSnapshot.activeOverlays[0]?.headline ?? null;

    return Object.freeze({
      version: CHAT_SEASONAL_LIVEOPS_OVERLAY_SERVICE_VERSION,
      totalDefinitions: this.records.size,
      totalSeasons: this.seasonIndex.size,
      totalTags: this.tagIndex.size,
      activeSeasonId: runtimeSnapshot.activeSeasonId ?? null,
      activeHeadline,
      kinds: Object.freeze([...LIVEOPS_OVERLAY_KINDS]),
      intensities: Object.freeze([...LIVEOPS_INTENSITY_BANDS]),
      channels: Object.freeze([...LIVEOPS_CHANNEL_IDS]),
    });
  }

  listMutations(limit = 128): readonly ChatSeasonalLiveOpsOverlayMutation[] {
    const normalizedLimit = sanitizePositiveInteger(limit, 128);
    return Object.freeze(this.journal.slice(-normalizedLimit).map(cloneMutation));
  }

  // ========================================================================
  // MARK: Internal query engine
  // ========================================================================

  private queryRecords(
    query: ChatSeasonalLiveOpsOverlayQuery,
  ): readonly ChatSeasonalLiveOpsOverlayRecord[] {
    const candidateIds = this.selectCandidateIds(query);
    const limit = sanitizePositiveInteger(query.limit, DEFAULT_QUERY_LIMIT);
    const results: ChatSeasonalLiveOpsOverlayRecord[] = [];

    for (const overlayId of candidateIds) {
      const record = this.records.get(overlayId);
      if (!record) {
        continue;
      }

      if (!this.matchesQuery(record, query)) {
        continue;
      }

      results.push(record);
      if (results.length >= limit) {
        break;
      }
    }

    results.sort(compareOverlayRecordsBySchedule);
    return Object.freeze(results);
  }

  private selectCandidateIds(query: ChatSeasonalLiveOpsOverlayQuery): readonly string[] {
    const candidateSets: Set<string>[] = [];

    if (query.overlayIds?.length) {
      candidateSets.push(new Set(query.overlayIds));
    }

    if (typeof query.seasonId === 'string') {
      candidateSets.push(this.seasonIndex.get(query.seasonId) ?? new Set<string>());
    }

    if (query.kind) {
      candidateSets.push(this.kindIndex.get(query.kind) ?? new Set<string>());
    }

    if (query.kinds?.length) {
      candidateSets.push(this.unionSets(query.kinds.map((kind) => this.kindIndex.get(kind))));
    }

    if (query.intensity) {
      candidateSets.push(this.intensityIndex.get(query.intensity) ?? new Set<string>());
    }

    if (query.intensities?.length) {
      candidateSets.push(
        this.unionSets(
          query.intensities.map((intensity) => this.intensityIndex.get(intensity)),
        ),
      );
    }

    if (query.channelId) {
      candidateSets.push(this.channelIndex.get(query.channelId) ?? new Set<string>());
    }

    if (query.tagsAny?.length) {
      candidateSets.push(
        this.unionSets(query.tagsAny.map((tag) => this.tagIndex.get(normalizeTag(tag)))),
      );
    }

    if (query.tagsAll?.length) {
      for (const tag of query.tagsAll) {
        candidateSets.push(this.tagIndex.get(normalizeTag(tag)) ?? new Set<string>());
      }
    }

    if (candidateSets.length === 0) {
      return Object.freeze([...this.records.keys()].sort());
    }

    const [first, ...rest] = candidateSets;
    const intersection = new Set<string>(first);

    for (const candidate of rest) {
      for (const overlayId of [...intersection]) {
        if (!candidate.has(overlayId)) {
          intersection.delete(overlayId);
        }
      }
    }

    return Object.freeze([...intersection].sort());
  }

  private matchesQuery(
    record: ChatSeasonalLiveOpsOverlayRecord,
    query: ChatSeasonalLiveOpsOverlayQuery,
  ): boolean {
    const definition = record.definition;

    if (query.activeAt != null) {
      const window = createOverlayWindow(definition, query.activeAt);
      if (!window.isActive) {
        return false;
      }
    }

    if (!query.includeExpired) {
      // default behavior: only exclude expired when explicitly activeAt is not set
      // and caller asked for a future-safe list by channel/season/tag/text.
      if (query.activeAt == null && definition.endsAt < this.now()) {
        return false;
      }
    }

    if (typeof query.seasonId === 'string' && (definition.seasonId ?? null) !== query.seasonId) {
      return false;
    }

    if (query.kind && definition.kind !== query.kind) {
      return false;
    }

    if (query.kinds?.length && !query.kinds.includes(definition.kind)) {
      return false;
    }

    if (query.intensity && definition.intensity !== query.intensity) {
      return false;
    }

    if (query.intensities?.length && !query.intensities.includes(definition.intensity)) {
      return false;
    }

    if (
      query.channelId &&
      (definition.channelPriority[query.channelId] ?? 0) <= 0
    ) {
      return false;
    }

    if (query.tagsAny?.length) {
      const tags = new Set(definition.tags.map(normalizeTag));
      const matched = query.tagsAny.some((tag) => tags.has(normalizeTag(tag)));
      if (!matched) {
        return false;
      }
    }

    if (query.tagsAll?.length) {
      const tags = new Set(definition.tags.map(normalizeTag));
      for (const tag of query.tagsAll) {
        if (!tags.has(normalizeTag(tag))) {
          return false;
        }
      }
    }

    if (query.text) {
      const needle = query.text.trim().toLowerCase();
      if (needle.length > 0 && !definitionSearchHaystack(definition).includes(needle)) {
        return false;
      }
    }

    return true;
  }

  private unionSets(sets: readonly (Set<string> | undefined)[]): Set<string> {
    const result = new Set<string>();
    for (const candidate of sets) {
      if (!candidate) {
        continue;
      }
      for (const value of candidate) {
        result.add(value);
      }
    }
    return result;
  }

  // ========================================================================
  // MARK: Index management
  // ========================================================================

  private attachIndexes(record: ChatSeasonalLiveOpsOverlayRecord): void {
    const definition = record.definition;

    if (definition.seasonId) {
      if (!this.seasonIndex.has(definition.seasonId)) {
        this.seasonIndex.set(definition.seasonId, new Set<string>());
      }
      this.seasonIndex.get(definition.seasonId)?.add(record.overlayId);
    }

    this.kindIndex.get(definition.kind)?.add(record.overlayId);
    this.intensityIndex.get(definition.intensity)?.add(record.overlayId);

    for (const channelId of LIVEOPS_CHANNEL_IDS) {
      if ((definition.channelPriority[channelId] ?? 0) > 0) {
        this.channelIndex.get(channelId)?.add(record.overlayId);
      }
    }

    for (const tag of definition.tags) {
      const normalized = normalizeTag(tag);
      if (!this.tagIndex.has(normalized)) {
        this.tagIndex.set(normalized, new Set<string>());
      }
      this.tagIndex.get(normalized)?.add(record.overlayId);
    }
  }

  private detachIndexes(record: ChatSeasonalLiveOpsOverlayRecord): void {
    const definition = record.definition;

    if (definition.seasonId) {
      const seasonSet = this.seasonIndex.get(definition.seasonId);
      seasonSet?.delete(record.overlayId);
      if (seasonSet && seasonSet.size === 0) {
        this.seasonIndex.delete(definition.seasonId);
      }
    }

    this.kindIndex.get(definition.kind)?.delete(record.overlayId);
    this.intensityIndex.get(definition.intensity)?.delete(record.overlayId);

    for (const channelId of LIVEOPS_CHANNEL_IDS) {
      this.channelIndex.get(channelId)?.delete(record.overlayId);
    }

    for (const tag of definition.tags) {
      const normalized = normalizeTag(tag);
      const tagSet = this.tagIndex.get(normalized);
      tagSet?.delete(record.overlayId);
      if (tagSet && tagSet.size === 0) {
        this.tagIndex.delete(normalized);
      }
    }
  }

  private clearIndexesOnly(): void {
    this.seasonIndex.clear();
    this.tagIndex.clear();

    for (const kind of LIVEOPS_OVERLAY_KINDS) {
      this.kindIndex.set(kind, new Set<string>());
    }

    for (const intensity of LIVEOPS_INTENSITY_BANDS) {
      this.intensityIndex.set(intensity, new Set<string>());
    }

    for (const channelId of LIVEOPS_CHANNEL_IDS) {
      this.channelIndex.set(channelId, new Set<string>());
    }
  }

  private rebuildRuntime(): void {
    this.runtime = new ChatSeasonalLiveOpsOverlay();
    const definitions = [...this.records.values()]
      .sort(compareOverlayRecordsBySchedule)
      .map((record) => record.definition);

    this.runtime.upsertMany(definitions);
  }

  private pushMutation(input: Omit<ChatSeasonalLiveOpsOverlayMutation, 'sequence'>): void {
    const record = Object.freeze({
      sequence: ++this.mutationSequence,
      action: input.action,
      at: input.at,
      overlayIds: Object.freeze([...input.overlayIds]),
      source: input.source,
      note: input.note,
      registrySizeAfter: input.registrySizeAfter,
    }) satisfies ChatSeasonalLiveOpsOverlayMutation;

    this.journal.push(record);
    if (this.journal.length > this.journalLimit) {
      this.journal.splice(0, this.journal.length - this.journalLimit);
    }
  }
}

// ============================================================================
// MARK: Factory
// ============================================================================

export function createChatSeasonalLiveOpsOverlayService(
  options: ChatSeasonalLiveOpsOverlayServiceOptions = {},
): ChatSeasonalLiveOpsOverlayService {
  return new ChatSeasonalLiveOpsOverlayService(options);
}

// ============================================================================
// MARK: Pure helpers
// ============================================================================

function createOverlayRecord(
  definition: ChatLiveOpsOverlayDefinition,
  previous: ChatSeasonalLiveOpsOverlayRecord | undefined,
  now: number,
  source: string,
): ChatSeasonalLiveOpsOverlayRecord {
  return Object.freeze({
    overlayId: definition.overlayId,
    definition: cloneOverlayDefinition(definition),
    revision: (previous?.revision ?? 0) + 1,
    insertedAt: previous?.insertedAt ?? now,
    updatedAt: now,
    mutationCount: (previous?.mutationCount ?? 0) + 1,
    source,
  });
}

function compareOverlayRecordsBySchedule(
  left: ChatSeasonalLiveOpsOverlayRecord,
  right: ChatSeasonalLiveOpsOverlayRecord,
): number {
  return compareOverlayDefinitionsBySchedule(left.definition, right.definition);
}

function compareOverlayDefinitionsBySchedule(
  left: ChatLiveOpsOverlayDefinition,
  right: ChatLiveOpsOverlayDefinition,
): number {
  return (
    left.startsAt - right.startsAt ||
    left.endsAt - right.endsAt ||
    left.displayName.localeCompare(right.displayName) ||
    left.overlayId.localeCompare(right.overlayId)
  );
}

function normalizeOverlayDefinition(
  definition: ChatLiveOpsOverlayDefinition,
): ChatLiveOpsOverlayDefinition {
  const overlayId = definition.overlayId.trim();
  if (overlayId.length === 0) {
    throw new Error('ChatLiveOpsOverlayDefinition.overlayId must be non-empty');
  }

  const startsAt = Number.isFinite(definition.startsAt)
    ? definition.startsAt
    : Date.now();
  const endsAt = Number.isFinite(definition.endsAt)
    ? definition.endsAt
    : startsAt;

  const normalizedRuleSet = Object.freeze(
    definition.rules.map((rule) =>
      Object.freeze({
        ...rule,
        ruleId: rule.ruleId.trim(),
        appliesToBots: rule.appliesToBots
          ? Object.freeze([...rule.appliesToBots])
          : undefined,
        appliesToChannels: rule.appliesToChannels
          ? Object.freeze([...rule.appliesToChannels])
          : undefined,
        requiredTags: rule.requiredTags
          ? Object.freeze(rule.requiredTags.map(normalizeTag))
          : undefined,
        addedPlanningTags: Object.freeze(rule.addedPlanningTags.map(normalizeTag)),
        transformBiases: Object.freeze(
          rule.transformBiases.map((value) => value.trim()).filter(Boolean),
        ),
        pressureDelta: clamp01(rule.pressureDelta),
        publicnessDelta: clamp01(rule.publicnessDelta),
        callbackAggressionDelta: clamp01(rule.callbackAggressionDelta),
      }),
    ),
  );

  const normalized: ChatLiveOpsOverlayDefinition = Object.freeze({
    overlayId,
    seasonId: definition.seasonId?.trim() || null,
    displayName: definition.displayName.trim(),
    kind: definition.kind,
    intensity: definition.intensity,
    startsAt: Math.min(startsAt, endsAt),
    endsAt: Math.max(startsAt, endsAt),
    headline: definition.headline.trim(),
    summaryLines: Object.freeze(
      definition.summaryLines.map((line) => line.trim()).filter(Boolean),
    ),
    tags: Object.freeze([...new Set(definition.tags.map(normalizeTag))]),
    channelPriority: freezeChannelPriority(definition.channelPriority),
    rules: normalizedRuleSet,
  });

  return normalized;
}

function freezeChannelPriority(
  value: ChatLiveOpsOverlayDefinition['channelPriority'],
): ChatLiveOpsOverlayDefinition['channelPriority'] {
  return Object.freeze({
    GLOBAL: sanitizeNumber(value.GLOBAL),
    SYNDICATE: sanitizeNumber(value.SYNDICATE),
    DEAL_ROOM: sanitizeNumber(value.DEAL_ROOM),
    LOBBY: sanitizeNumber(value.LOBBY),
  }) as ChatLiveOpsOverlayDefinition['channelPriority'];
}

function createOverlayWindow(
  definition: ChatLiveOpsOverlayDefinition,
  now: number,
): ChatSeasonalLiveOpsOverlayWindow {
  const state: ChatSeasonalLiveOpsOverlayWindowState =
    now < definition.startsAt
      ? 'UPCOMING'
      : now > definition.endsAt
        ? 'EXPIRED'
        : 'ACTIVE';

  return {
    overlayId: definition.overlayId,
    state,
    startsAt: definition.startsAt,
    endsAt: definition.endsAt,
    durationMs: Math.max(0, definition.endsAt - definition.startsAt),
    msUntilStart: definition.startsAt - now,
    msUntilEnd: definition.endsAt - now,
    isActive: state === 'ACTIVE',
    isUpcoming: state === 'UPCOMING',
    isExpired: state === 'EXPIRED',
  };
}

function freezeWindow(
  value: ChatSeasonalLiveOpsOverlayWindow,
): ChatSeasonalLiveOpsOverlayWindow {
  return Object.freeze({ ...value });
}

function cloneOverlayDefinition(
  definition: ChatLiveOpsOverlayDefinition,
): ChatLiveOpsOverlayDefinition {
  return Object.freeze({
    overlayId: definition.overlayId,
    seasonId: definition.seasonId ?? null,
    displayName: definition.displayName,
    kind: definition.kind,
    intensity: definition.intensity,
    startsAt: definition.startsAt,
    endsAt: definition.endsAt,
    headline: definition.headline,
    summaryLines: Object.freeze([...definition.summaryLines]),
    tags: Object.freeze([...definition.tags]),
    channelPriority: freezeChannelPriority(definition.channelPriority),
    rules: Object.freeze(
      definition.rules.map((rule) =>
        Object.freeze({
          ruleId: rule.ruleId,
          appliesToBots: rule.appliesToBots
            ? Object.freeze([...rule.appliesToBots])
            : undefined,
          appliesToChannels: rule.appliesToChannels
            ? Object.freeze([...rule.appliesToChannels])
            : undefined,
          requiredTags: rule.requiredTags
            ? Object.freeze([...rule.requiredTags])
            : undefined,
          addedPlanningTags: Object.freeze([...rule.addedPlanningTags]),
          transformBiases: Object.freeze([...rule.transformBiases]),
          pressureDelta: rule.pressureDelta,
          publicnessDelta: rule.publicnessDelta,
          callbackAggressionDelta: rule.callbackAggressionDelta,
        }),
      ),
    ),
  });
}

function cloneOverlayRecord(
  record: ChatSeasonalLiveOpsOverlayRecord,
): ChatSeasonalLiveOpsOverlayRecord {
  return Object.freeze({
    overlayId: record.overlayId,
    definition: cloneOverlayDefinition(record.definition),
    revision: record.revision,
    insertedAt: record.insertedAt,
    updatedAt: record.updatedAt,
    mutationCount: record.mutationCount,
    source: record.source,
  });
}

function cloneOverlayContext(
  context: ChatLiveOpsOverlayContext,
): ChatLiveOpsOverlayContext {
  return Object.freeze({
    now: context.now,
    overlayId: context.overlayId,
    displayName: context.displayName,
    kind: context.kind,
    intensity: context.intensity,
    seasonId: context.seasonId ?? null,
    headline: context.headline,
    tags: Object.freeze([...context.tags]),
    transformBiases: Object.freeze([...context.transformBiases]),
    pressureDelta: context.pressureDelta,
    publicnessDelta: context.publicnessDelta,
    callbackAggressionDelta: context.callbackAggressionDelta,
    notes: Object.freeze([...context.notes]),
  });
}

function cloneMutation(
  value: ChatSeasonalLiveOpsOverlayMutation,
): ChatSeasonalLiveOpsOverlayMutation {
  return Object.freeze({
    sequence: value.sequence,
    action: value.action,
    at: value.at,
    overlayIds: Object.freeze([...value.overlayIds]),
    source: value.source,
    note: value.note,
    registrySizeAfter: value.registrySizeAfter,
  });
}

function scoreResolvedOverlay(context: ChatLiveOpsOverlayContext): number {
  return (
    intensityWeight(context.intensity) +
    context.pressureDelta * 0.35 +
    context.callbackAggressionDelta * 0.20 +
    context.publicnessDelta * 0.15
  );
}

function intensityWeight(intensity: ChatLiveOpsIntensityBand): number {
  switch (intensity) {
    case 'WORLD_CLASS':
      return 1;
    case 'SEVERE':
      return 0.78;
    case 'ACTIVE':
      return 0.55;
    default:
      return 0.28;
  }
}

function definitionSearchHaystack(
  definition: ChatLiveOpsOverlayDefinition,
): string {
  return [
    definition.overlayId,
    definition.seasonId ?? '',
    definition.displayName,
    definition.kind,
    definition.intensity,
    definition.headline,
    ...definition.summaryLines,
    ...definition.tags,
    ...definition.rules.flatMap((rule) => [
      rule.ruleId,
      ...(rule.requiredTags ?? []),
      ...rule.addedPlanningTags,
      ...rule.transformBiases,
      ...(rule.appliesToBots ?? []),
      ...(rule.appliesToChannels ?? []),
    ]),
  ]
    .join(' ')
    .toLowerCase();
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function sanitizeNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function sanitizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}
