// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/syndicateLeaderboard.ts
// Sprint 5 — Syndicate Leaderboard System
//
// Four ranked boards:
//   TrustLeaderboard        — ranked by trust + cooperation score
//   SynergyHallOfFame       — top synergy peak runs, immortal entries
//   DefectionShameBoard     — permanent defection records (no removal)
//   AllianceRankings        — weekly + season combined scores
//
// Season reset logic:
//   - Weekly scores reset every Sunday 00:00 UTC
//   - Season scores snapshot weekly winner then reset
//   - ShameBoard is NEVER reset (permanent record)
// ═══════════════════════════════════════════════════════════════════════════

import type { TrustAuditRecord } from './trustAuditBuilder';

// ─── Shared Types ──────────────────────────────────────────────────────────────

export interface LeaderboardTimestamp {
  runId: string;
  playerId: string;
  playerName: string;
  recordedAt: number; // Unix ms
  seasonId: string;
  weekId: string;     // YYYY-WNN
}

// ─── Trust Leaderboard ────────────────────────────────────────────────────────

export interface TrustLeaderboardEntry extends LeaderboardTimestamp {
  finalTrust: number;
  trustLabel: string;
  cooperationScore: number;
  integrityScore: number;
  /** Composite: trust * 0.5 + cooperation * 0.3 + integrity * 0.2 */
  compositeScore: number;
  verdict: TrustAuditRecord['verdict'];
  rank: number;
}

export interface TrustLeaderboard {
  entries: TrustLeaderboardEntry[];
  /** Max entries stored */
  capacity: number;
  lastUpdated: number;
}

export function createTrustLeaderboard(capacity = 100): TrustLeaderboard {
  return { entries: [], capacity, lastUpdated: Date.now() };
}

export function insertTrustEntry(
  board: TrustLeaderboard,
  entry: Omit<TrustLeaderboardEntry, 'rank'>,
): TrustLeaderboard {
  const withRank = { ...entry, rank: 0 };
  const merged = [...board.entries, withRank]
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, board.capacity)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return { ...board, entries: merged, lastUpdated: Date.now() };
}

// ─── Synergy Hall of Fame ─────────────────────────────────────────────────────

export interface SynergyHallEntry extends LeaderboardTimestamp {
  /** Peak synergy value hit during the run (0–1) */
  peakSynergy: number;
  /** Tick at which peak was hit */
  peakTick: number;
  /** Full alliance member IDs at peak */
  allianceSnapshot: string[];
  /** Total full-synergy ticks sustained */
  fullSynergyTicks: number;
  /** Total income generated during peak synergy window */
  peakWindowIncome: number;
  rank: number;
}

export interface SynergyHallOfFame {
  entries: SynergyHallEntry[];
  capacity: number;
  lastUpdated: number;
}

export function createSynergyHallOfFame(capacity = 50): SynergyHallOfFame {
  return { entries: [], capacity, lastUpdated: Date.now() };
}

export function insertSynergyEntry(
  hall: SynergyHallOfFame,
  entry: Omit<SynergyHallEntry, 'rank'>,
): SynergyHallOfFame {
  const withRank = { ...entry, rank: 0 };
  const merged = [...hall.entries, withRank]
    .sort((a, b) =>
      b.peakSynergy !== a.peakSynergy
        ? b.peakSynergy - a.peakSynergy
        : b.fullSynergyTicks - a.fullSynergyTicks,
    )
    .slice(0, hall.capacity)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return { ...hall, entries: merged, lastUpdated: Date.now() };
}

// ─── Defection Shame Board ────────────────────────────────────────────────────

export interface DefectionShameEntry extends LeaderboardTimestamp {
  defectionStep: 'PARTIAL' | 'COMPLETE';
  detected: boolean;
  detectedByPlayerId: string | null;
  /** Tick defection was completed or abandoned */
  defectionTick: number;
  /** Treasury seized (if ASSET_SEIZURE completed) */
  treasurySeized: number;
  /** Trust at time of defection */
  trustAtDefection: number;
  /** Total alliance runs ended by this defection */
  runsCollapsed: number;
  /** Permanent — this entry is never removed */
  permanent: true;
}

export interface DefectionShameBoard {
  entries: DefectionShameEntry[];
  /** Shame board is unbound — all defections recorded forever */
  totalDefections: number;
  lastUpdated: number;
}

export function createDefectionShameBoard(): DefectionShameBoard {
  return { entries: [], totalDefections: 0, lastUpdated: Date.now() };
}

/** Shame board only grows. No removals. No resets. */
export function recordDefection(
  board: DefectionShameBoard,
  entry: Omit<DefectionShameEntry, 'permanent'>,
): DefectionShameBoard {
  const shameEntry: DefectionShameEntry = { ...entry, permanent: true };
  return {
    entries: [...board.entries, shameEntry],
    totalDefections: board.totalDefections + 1,
    lastUpdated: Date.now(),
  };
}

/** Query shame board — never delete, only filter for display */
export function queryShameByPlayer(
  board: DefectionShameBoard,
  playerId: string,
): DefectionShameEntry[] {
  return board.entries.filter(e => e.playerId === playerId);
}

export function queryShameByWeek(
  board: DefectionShameBoard,
  weekId: string,
): DefectionShameEntry[] {
  return board.entries.filter(e => e.weekId === weekId);
}

// ─── Alliance Rankings ─────────────────────────────────────────────────────────

export interface AllianceRankEntry {
  allianceId: string;
  allianceName: string;
  memberIds: string[];
  memberNames: string[];

  /** Sum of member compositeScores this week */
  weeklyScore: number;
  weeklyRank: number;

  /** Cumulative across all weeks this season */
  seasonScore: number;
  seasonRank: number;

  /** Combined score: week * 0.4 + season * 0.6 */
  combinedScore: number;
  combinedRank: number;

  weekId: string;
  seasonId: string;
  lastUpdated: number;
}

export interface AllianceRankings {
  entries: Record<string, AllianceRankEntry>; // allianceId → entry
  weeklyRanked: string[];   // sorted allianceId[] by weeklyScore
  seasonRanked: string[];   // sorted by seasonScore
  combinedRanked: string[]; // sorted by combinedScore
  lastUpdated: number;
}

export function createAllianceRankings(): AllianceRankings {
  return {
    entries: {},
    weeklyRanked: [],
    seasonRanked: [],
    combinedRanked: [],
    lastUpdated: Date.now(),
  };
}

export function upsertAllianceScore(
  rankings: AllianceRankings,
  allianceId: string,
  allianceName: string,
  memberIds: string[],
  memberNames: string[],
  weeklyDelta: number,
  seasonDelta: number,
  weekId: string,
  seasonId: string,
): AllianceRankings {
  const existing = rankings.entries[allianceId];
  const weeklyScore = (existing?.weeklyScore ?? 0) + weeklyDelta;
  const seasonScore = (existing?.seasonScore ?? 0) + seasonDelta;
  const combinedScore = weeklyScore * 0.4 + seasonScore * 0.6;

  const updated: AllianceRankEntry = {
    allianceId, allianceName, memberIds, memberNames,
    weeklyScore, seasonScore, combinedScore,
    weeklyRank: 0, seasonRank: 0, combinedRank: 0,
    weekId, seasonId, lastUpdated: Date.now(),
  };

  const newEntries = { ...rankings.entries, [allianceId]: updated };
  const allEntries = Object.values(newEntries);

  const weeklyRanked  = [...allEntries].sort((a, b) => b.weeklyScore - a.weeklyScore).map(e => e.allianceId);
  const seasonRanked  = [...allEntries].sort((a, b) => b.seasonScore - a.seasonScore).map(e => e.allianceId);
  const combinedRanked = [...allEntries].sort((a, b) => b.combinedScore - a.combinedScore).map(e => e.allianceId);

  // Stamp ranks
  weeklyRanked.forEach((id, i)   => { newEntries[id].weeklyRank = i + 1; });
  seasonRanked.forEach((id, i)   => { newEntries[id].seasonRank = i + 1; });
  combinedRanked.forEach((id, i) => { newEntries[id].combinedRank = i + 1; });

  return { entries: newEntries, weeklyRanked, seasonRanked, combinedRanked, lastUpdated: Date.now() };
}

// ─── Season Reset Logic ────────────────────────────────────────────────────────

export interface SeasonSnapshot {
  seasonId: string;
  endedAt: number;
  topTrustEntry: TrustLeaderboardEntry | null;
  topSynergyEntry: SynergyHallEntry | null;
  topAllianceEntry: AllianceRankEntry | null;
  totalDefections: number;
}

/**
 * Resets weekly scores on all AllianceRankEntries.
 * Snapshots top entries before reset.
 * DefectionShameBoard is intentionally excluded — permanent record.
 */
export function executeWeeklyReset(
  trust: TrustLeaderboard,
  synergy: SynergyHallOfFame,
  alliances: AllianceRankings,
  shame: DefectionShameBoard,
  seasonId: string,
): {
  snapshot: SeasonSnapshot;
  resetAlliances: AllianceRankings;
} {
  const snapshot: SeasonSnapshot = {
    seasonId,
    endedAt: Date.now(),
    topTrustEntry:    trust.entries[0]   ?? null,
    topSynergyEntry:  synergy.entries[0] ?? null,
    topAllianceEntry: alliances.entries[alliances.combinedRanked[0]] ?? null,
    totalDefections:  shame.totalDefections,
  };

  // Reset weekly scores, preserve season scores
  const resetEntries: Record<string, AllianceRankEntry> = {};
  for (const [id, entry] of Object.entries(alliances.entries)) {
    resetEntries[id] = { ...entry, weeklyScore: 0, weeklyRank: 0 };
  }

  const resetAlliances: AllianceRankings = {
    ...alliances,
    entries: resetEntries,
    weeklyRanked: [],
    lastUpdated: Date.now(),
  };

  return { snapshot, resetAlliances };
}

/**
 * Full season reset — wipes weekly + season scores.
 * Trust board and Synergy HoF also clear.
 * ShameBoard survives all resets.
 */
export function executeSeasonReset(
  trust: TrustLeaderboard,
  synergy: SynergyHallOfFame,
  alliances: AllianceRankings,
  shame: DefectionShameBoard,
  newSeasonId: string,
): {
  trust: TrustLeaderboard;
  synergy: SynergyHallOfFame;
  alliances: AllianceRankings;
  shame: DefectionShameBoard; // unchanged
} {
  return {
    trust: createTrustLeaderboard(trust.capacity),
    synergy: createSynergyHallOfFame(synergy.capacity),
    alliances: createAllianceRankings(),
    shame, // permanent — never reset
  };
}

// ─── Builder from TrustAuditRecord ────────────────────────────────────────────

export interface BuildLeaderboardEntryInput {
  audit: TrustAuditRecord;
  playerName: string;
  seasonId: string;
  weekId: string;
}

/**
 * Derives a TrustLeaderboardEntry directly from a TrustAuditRecord.
 * Composite formula: trust*0.5 + cooperation*0.3 + integrity*0.2
 */
export function buildLeaderboardEntry(
  input: BuildLeaderboardEntryInput,
): Omit<TrustLeaderboardEntry, 'rank'> {
  const { audit, playerName, seasonId, weekId } = input;

  const compositeScore = parseFloat(
    (
      audit.trustFinalityScore * 0.5 +
      audit.cooperationScore   * 0.3 +
      audit.integrityScore     * 0.2
    ).toFixed(4),
  );

  return {
    runId:          audit.runId,
    playerId:       audit.playerId,
    playerName,
    recordedAt:     Date.now(),
    seasonId,
    weekId,
    finalTrust:     audit.finalTrust,
    trustLabel:     audit.trustLabel,
    cooperationScore: audit.cooperationScore,
    integrityScore:   audit.integrityScore,
    compositeScore,
    verdict:        audit.verdict,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Returns YYYY-WNN string from a Date */
export function getWeekId(date: Date = new Date()): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7,
  );
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Returns SEASON-N string based on month/year grouping (quarterly) */
export function getSeasonId(date: Date = new Date()): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-S${quarter}`;
}