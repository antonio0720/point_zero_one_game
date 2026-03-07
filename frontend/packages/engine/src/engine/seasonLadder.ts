/**
 * PZO SPRINT 8 — src/engine/seasonLadder.ts
 *
 * League / Season infrastructure:
 *   - Season state (weeks, episodes, periods)
 *   - ELO-adjacent rating system (PZO-adapted)
 *   - Ladder scoring rules
 *   - Season record and history
 *   - Club standings aggregation
 */

// ─── Season Config ────────────────────────────────────────────────────────────

export interface SeasonConfig {
  seasonId: string;
  name: string;
  startDate: string;        // ISO
  endDate: string;          // ISO
  format: 'weekly' | 'monthly' | 'open';
  maxRunsPerPeriod: number; // best N runs count per period
  scoringMode: 'best_run' | 'cumulative' | 'ranked_avg';
  rulePackHash: string;     // must match for result to count
  allowedPresets: string[];
  tiebreaker: 'net_worth' | 'cashflow' | 'resilience_score' | 'timestamp';
}

// ─── Player Season Record ─────────────────────────────────────────────────────

export interface RunRecord {
  runId: string;
  playerId: string;
  clubId: string | null;
  matchHash: string;
  rulePackHash: string;
  timestamp: number;
  // Core scores
  totalScore: number;
  grade: string;
  moneyScore: number;
  resilienceScore: number;
  disciplineScore: number;
  riskMgmtScore: number;
  objectiveBonus: number;
  difficultyMultiplier: number;
  // Financial
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  finalExpenses: number;
  // Meta
  difficultyPreset: string;
  survivedRun: boolean;
  completedObjectiveIds: string[];
  totalPlays: number;
  verified: boolean;
}

export interface PlayerSeasonRecord {
  playerId: string;
  displayName: string;
  avatarEmoji: string;
  clubId: string | null;
  runs: RunRecord[];
  // Computed
  ladderRating: number;
  ladderRank: number | null;
  totalRuns: number;
  bestRunScore: number;
  averageScore: number;
  winRate: number;          // % of runs with grade A or S
  currentStreak: number;    // consecutive runs with positive cashflow
  achievements: string[];
  seasonPoints: number;
}

// ─── Ladder Rating (ELO-adjacent, adapted for solo + club modes) ──────────────

const BASE_RATING = 1000;
const K_FACTOR_SOLO = 16;
const K_FACTOR_COMPETITIVE = 32;
const SCORE_ANCHOR = 750;       // score that maps to no rating change

export function computeRatingDelta(
  currentRating: number,
  runScore: number,
  difficultyMultiplier: number,
  isCompetitive: boolean,
): number {
  const K = isCompetitive ? K_FACTOR_COMPETITIVE : K_FACTOR_SOLO;

  // Expected performance based on current rating (logistic)
  const expectedPctile = 1 / (1 + Math.pow(10, (SCORE_ANCHOR - currentRating) / 400));
  // Actual performance (run score normalized to 0–1)
  const actualPctile = Math.min(1, runScore / 1200);

  const delta = K * (actualPctile - expectedPctile) * difficultyMultiplier;
  return Math.round(delta);
}

export function updatePlayerRating(record: PlayerSeasonRecord, newRun: RunRecord): number {
  const delta = computeRatingDelta(
    record.ladderRating,
    newRun.totalScore,
    newRun.difficultyMultiplier,
    newRun.verified,
  );
  return Math.max(0, record.ladderRating + delta);
}

// ─── Season Points Calculation ────────────────────────────────────────────────

export function computeSeasonPoints(
  record: PlayerSeasonRecord,
  config: SeasonConfig,
): number {
  if (record.runs.length === 0) return 0;

  const verifiedRuns = record.runs.filter(r => r.verified || r.difficultyPreset === 'INTRO');

  switch (config.scoringMode) {
    case 'best_run':
      return verifiedRuns.length > 0
        ? Math.max(...verifiedRuns.map(r => r.totalScore))
        : 0;

    case 'cumulative':
      return verifiedRuns
        .slice(-config.maxRunsPerPeriod)
        .reduce((sum, r) => sum + r.totalScore, 0);

    case 'ranked_avg': {
      const sorted = verifiedRuns.sort((a, b) => b.totalScore - a.totalScore);
      const top = sorted.slice(0, config.maxRunsPerPeriod);
      return top.length > 0
        ? Math.round(top.reduce((s, r) => s + r.totalScore, 0) / top.length)
        : 0;
    }

    default:
      return 0;
  }
}

// ─── Ladder Standings Computation ────────────────────────────────────────────

export interface LadderEntry {
  rank: number;
  playerId: string;
  displayName: string;
  avatarEmoji: string;
  clubId: string | null;
  ladderRating: number;
  seasonPoints: number;
  bestRunScore: number;
  averageScore: number;
  totalRuns: number;
  winRate: number;
  grade: string;
  ratingDelta: number | null;   // change from last period
  isVerified: boolean;
}

export function buildLadderStandings(
  records: PlayerSeasonRecord[],
  config: SeasonConfig,
): LadderEntry[] {
  const entries: LadderEntry[] = records.map(record => {
    const seasonPoints = computeSeasonPoints(record, config);
    const verifiedRuns = record.runs.filter(r => r.verified);
    const winCount = record.runs.filter(r => r.grade === 'S' || r.grade === 'A').length;

    const avgScore = record.runs.length > 0
      ? Math.round(record.runs.reduce((s, r) => s + r.totalScore, 0) / record.runs.length)
      : 0;

    // Grade based on current rating
    const grade =
      record.ladderRating >= 1400 ? 'S' :
      record.ladderRating >= 1200 ? 'A' :
      record.ladderRating >= 1000 ? 'B' :
      record.ladderRating >= 800  ? 'C' :
      record.ladderRating >= 600  ? 'D' : 'F';

    return {
      rank: 0,               // filled after sort
      playerId: record.playerId,
      displayName: record.displayName,
      avatarEmoji: record.avatarEmoji,
      clubId: record.clubId,
      ladderRating: record.ladderRating,
      seasonPoints,
      bestRunScore: record.bestRunScore,
      averageScore: avgScore,
      totalRuns: record.totalRuns,
      winRate: record.totalRuns > 0 ? winCount / record.totalRuns : 0,
      grade,
      ratingDelta: null,
      isVerified: verifiedRuns.length > 0,
    };
  });

  // Sort by season points, tiebreaker by ladder rating
  entries.sort((a, b) => {
    if (b.seasonPoints !== a.seasonPoints) return b.seasonPoints - a.seasonPoints;
    if (b.ladderRating !== a.ladderRating) return b.ladderRating - a.ladderRating;
    return b.bestRunScore - a.bestRunScore;
  });

  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

// ─── Club Standings (aggregate club member scores) ───────────────────────────

export interface ClubStandingEntry {
  rank: number;
  clubId: string;
  clubName: string;
  memberCount: number;
  avgLadderRating: number;
  totalSeasonPoints: number;
  topPlayerName: string;
  topPlayerRating: number;
  wins: number;            // total A/S grades across all members
}

export function buildClubStandings(
  playerRecords: PlayerSeasonRecord[],
  clubNames: Record<string, string>,
  config: SeasonConfig,
): ClubStandingEntry[] {
  const byClub: Record<string, PlayerSeasonRecord[]> = {};

  for (const record of playerRecords) {
    if (!record.clubId) continue;
    if (!byClub[record.clubId]) byClub[record.clubId] = [];
    byClub[record.clubId].push(record);
  }

  const entries: ClubStandingEntry[] = Object.entries(byClub).map(([clubId, members]) => {
    const avgRating = Math.round(members.reduce((s, m) => s + m.ladderRating, 0) / members.length);
    const totalPoints = members.reduce((s, m) => s + computeSeasonPoints(m, config), 0);
    const topMember = [...members].sort((a, b) => b.ladderRating - a.ladderRating)[0];
    const wins = members.reduce((s, m) => s + m.runs.filter(r => r.grade === 'A' || r.grade === 'S').length, 0);

    return {
      rank: 0,
      clubId,
      clubName: clubNames[clubId] ?? clubId,
      memberCount: members.length,
      avgLadderRating: avgRating,
      totalSeasonPoints: totalPoints,
      topPlayerName: topMember?.displayName ?? '—',
      topPlayerRating: topMember?.ladderRating ?? 0,
      wins,
    };
  });

  entries.sort((a, b) => b.totalSeasonPoints - a.totalSeasonPoints || b.avgLadderRating - a.avgLadderRating);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

// ─── Run Record Factory ───────────────────────────────────────────────────────

export function createRunRecord(
  runId: string,
  playerId: string,
  clubId: string | null,
  matchHash: string,
  rulePackHash: string,
  scoring: import('../components/ProofCardV2').ScoringBreakdown,
  financial: { cash: number; netWorth: number; income: number; expenses: number },
  meta: {
    difficultyPreset: string;
    survivedRun: boolean;
    completedObjectiveIds: string[];
    totalPlays: number;
    verified: boolean;
    grade: string;
  },
): RunRecord {
  return {
    runId,
    playerId,
    clubId,
    matchHash,
    rulePackHash,
    timestamp: Date.now(),
    totalScore: scoring.totalScore,
    grade: meta.grade,
    moneyScore: scoring.moneyScore,
    resilienceScore: scoring.resilienceScore,
    disciplineScore: scoring.disciplineScore,
    riskMgmtScore: scoring.riskMgmtScore,
    objectiveBonus: scoring.objectiveBonus,
    difficultyMultiplier: scoring.difficultyMultiplier,
    finalCash: financial.cash,
    finalNetWorth: financial.netWorth,
    finalIncome: financial.income,
    finalExpenses: financial.expenses,
    difficultyPreset: meta.difficultyPreset,
    survivedRun: meta.survivedRun,
    completedObjectiveIds: meta.completedObjectiveIds,
    totalPlays: meta.totalPlays,
    verified: meta.verified,
  };
}

// ─── Player Record Factory / Update ──────────────────────────────────────────

export function initPlayerRecord(playerId: string, displayName: string, avatarEmoji: string, clubId: string | null): PlayerSeasonRecord {
  return {
    playerId,
    displayName,
    avatarEmoji,
    clubId,
    runs: [],
    ladderRating: BASE_RATING,
    ladderRank: null,
    totalRuns: 0,
    bestRunScore: 0,
    averageScore: 0,
    winRate: 0,
    currentStreak: 0,
    achievements: [],
    seasonPoints: 0,
  };
}

export function addRunToRecord(
  record: PlayerSeasonRecord,
  run: RunRecord,
  config: SeasonConfig,
): PlayerSeasonRecord {
  const newRuns = [...record.runs, run];
  const newRating = updatePlayerRating(record, run);
  const totalRuns = newRuns.length;
  const best = Math.max(record.bestRunScore, run.totalScore);
  const avg = Math.round(newRuns.reduce((s, r) => s + r.totalScore, 0) / totalRuns);
  const wins = newRuns.filter(r => r.grade === 'A' || r.grade === 'S').length;
  const winRate = wins / totalRuns;

  // Streak: consecutive runs with positive cashflow
  let streak = 0;
  for (const r of [...newRuns].reverse()) {
    if (r.finalIncome > r.finalExpenses) streak++;
    else break;
  }

  // Achievements
  const achievements = [...record.achievements];
  if (best >= 1000 && !achievements.includes('MILLENNIAL_MIND')) achievements.push('MILLENNIAL_MIND');
  if (winRate >= 0.75 && totalRuns >= 5 && !achievements.includes('CONSISTENCY_KING')) achievements.push('CONSISTENCY_KING');
  if (streak >= 5 && !achievements.includes('HOT_STREAK')) achievements.push('HOT_STREAK');
  if (run.grade === 'S' && !achievements.includes('PERFECT_RUN')) achievements.push('PERFECT_RUN');

  return {
    ...record,
    runs: newRuns,
    ladderRating: newRating,
    totalRuns,
    bestRunScore: best,
    averageScore: avg,
    winRate,
    currentStreak: streak,
    achievements,
    seasonPoints: computeSeasonPoints({ ...record, runs: newRuns }, config),
  };
}
