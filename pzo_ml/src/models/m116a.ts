/**
 * M116a — Table Roles (ML/DL Companion: Role Fit Matcher + Conflict Predictor)
 * Source spec: ml/M116a_table_roles_ml_dl_companion_role_fit_matcher_conflict_predictor.md
 *
 * Suggests roles that match each player's style and reduce table friction.
 * Predicts sabotage/bailout conflict risk before run start (consent-safe).
 * Helps tables auto-balance roles for better content arcs.
 *
 * Inference: lobby only (pre-run). Budget ≤25ms server; cached.
 * Privacy: no raw chat/PII; hashed+bucketed features.
 *
 * Deploy to: pzo_ml/src/models/m116a.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TableRole = 'CALLER' | 'TREASURER' | 'SABOTEUR' | 'HISTORIAN';
export type PlayerStyle = 'AGGRESSIVE' | 'CONSERVATIVE' | 'CHAOTIC' | 'STRATEGIC' | 'SOCIAL';
export type ConflictRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ConsentMode = 'OPEN' | 'GUIDED' | 'COMPETITIVE';

export interface PlayerRoleSignals {
  playerId: string;                   // hashed for privacy
  preferredRoleTags: string[];        // opt-in: e.g. ['strategist', 'leader']
  roleHistory: Array<{ role: TableRole; sessionOutcome: 'WIN' | 'WIPE' | 'INCOMPLETE' }>;
  votePatternAggression: number;     // 0–1; derived from vote history
  sabotageFrequency: number;         // 0–1; how often player triggered saboteur events
  bailoutFrequency: number;          // 0–1; how often player triggered bailout events
  sessionOutcomeWinRate: number;     // 0–1
  toxicitySignal: number;            // 0–1; rule-based; 0 = clean
  avgDecisionTimeMs: number;         // from UI signals
  seasonParticipation: number;       // 0–1; engagement level
}

export interface TableRoleAssignmentRequest {
  runSeed: string;
  rulesetVersion: string;
  seasonModules: string[];
  players: PlayerRoleSignals[];
  consentGate: ConsentMode;
  preferAutoBalance: boolean;
}

export interface RoleSuggestion {
  playerId: string;
  suggestedRole: TableRole;
  fitScore: number;                  // 0–1
  styleTags: string[];               // e.g. ['strategist', 'chaos-safe']
  rationale: string;
  alternativeRole: TableRole | null;
}

export interface ConflictPrediction {
  riskLevel: ConflictRiskLevel;
  riskScore: number;                 // 0–1
  primaryDrivers: string[];
  recommendedConsentMode: ConsentMode;
  warningMessage: string | null;
}

export interface RoleAssignmentReceipt {
  runSeed: string;
  assignments: Array<{ playerId: string; role: TableRole; fitScore: number }>;
  conflictRisk: ConflictRiskLevel;
  rationalePublicTags: string[];
  receiptHash: string;
}

export interface M116aOutput {
  suggestions: RoleSuggestion[];
  conflictPrediction: ConflictPrediction;
  autoBalancedAssignment: Array<{ playerId: string; role: TableRole }> | null;
  receipt: RoleAssignmentReceipt;
  auditHash: string;
}

// ─── Interfaces for injection ─────────────────────────────────────────────────

export interface MlEnabled {
  isEnabled(): boolean;
}

export interface BoundedNudge {
  nudge(values: number[]): number[];
  nudgeScalar(value: number): number;
}

export interface AuditHash {
  compute(data: unknown): string;
  value: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_STYLE_AFFINITY: Record<TableRole, Record<PlayerStyle, number>> = {
  CALLER:     { AGGRESSIVE: 0.70, CONSERVATIVE: 0.50, CHAOTIC: 0.40, STRATEGIC: 0.85, SOCIAL: 0.65 },
  TREASURER:  { AGGRESSIVE: 0.40, CONSERVATIVE: 0.90, CHAOTIC: 0.20, STRATEGIC: 0.80, SOCIAL: 0.60 },
  SABOTEUR:   { AGGRESSIVE: 0.85, CONSERVATIVE: 0.20, CHAOTIC: 0.90, STRATEGIC: 0.50, SOCIAL: 0.30 },
  HISTORIAN:  { AGGRESSIVE: 0.30, CONSERVATIVE: 0.70, CHAOTIC: 0.35, STRATEGIC: 0.65, SOCIAL: 0.95 },
};

const ROLE_STYLE_TAGS: Record<TableRole, string[]> = {
  CALLER:     ['strategist', 'decisive', 'leader'],
  TREASURER:  ['methodical', 'conservative', 'chaos-safe'],
  SABOTEUR:   ['chaos-agent', 'high-risk', 'disruptor'],
  HISTORIAN:  ['observer', 'social', 'analyst'],
};

const STYLE_THRESHOLDS: Record<PlayerStyle, (signals: PlayerRoleSignals) => number> = {
  AGGRESSIVE:    s => clamp(s.votePatternAggression * 0.6 + s.sabotageFrequency * 0.4),
  CONSERVATIVE:  s => clamp((1 - s.votePatternAggression) * 0.5 + s.sessionOutcomeWinRate * 0.5),
  CHAOTIC:       s => clamp(s.sabotageFrequency * 0.7 + (1 - s.sessionOutcomeWinRate) * 0.3),
  STRATEGIC:     s => clamp(s.sessionOutcomeWinRate * 0.6 + s.seasonParticipation * 0.4),
  SOCIAL:        s => clamp((1 - s.toxicitySignal) * 0.5 + s.seasonParticipation * 0.5),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function inferPlayerStyle(signals: PlayerRoleSignals): PlayerStyle {
  let best: PlayerStyle = 'STRATEGIC';
  let bestScore = 0;
  for (const [style, fn] of Object.entries(STYLE_THRESHOLDS) as [PlayerStyle, (s: PlayerRoleSignals) => number][]) {
    const score = fn(signals);
    if (score > bestScore) { bestScore = score; best = style; }
  }
  return best;
}

function roleFitScore(role: TableRole, style: PlayerStyle, signals: PlayerRoleSignals): number {
  const styleAffinity = ROLE_STYLE_AFFINITY[role][style];
  // Prefer roles the player has won with before
  const historicalBoost = signals.roleHistory.filter(h => h.role === role && h.sessionOutcome === 'WIN').length * 0.05;
  // Opt-in preference tags alignment
  const tagMatch = ROLE_STYLE_TAGS[role].some(tag => signals.preferredRoleTags.includes(tag)) ? 0.10 : 0;
  return clamp(styleAffinity + historicalBoost + tagMatch);
}

// ─── Role Suggestions ─────────────────────────────────────────────────────────

function buildRoleSuggestions(players: PlayerRoleSignals[]): RoleSuggestion[] {
  return players.map(player => {
    const style = inferPlayerStyle(player);
    const roleScores = (Object.keys(ROLE_STYLE_AFFINITY) as TableRole[]).map(role => ({
      role,
      score: roleFitScore(role, style, player),
    })).sort((a, b) => b.score - a.score);

    const best = roleScores[0];
    const alt = roleScores[1];

    return {
      playerId: player.playerId,
      suggestedRole: best.role,
      fitScore: clamp(best.score),
      styleTags: ROLE_STYLE_TAGS[best.role],
      rationale: `Style: ${style} — best fit for ${best.role}`,
      alternativeRole: alt?.role ?? null,
    };
  });
}

// ─── Auto-Balance ─────────────────────────────────────────────────────────────

/**
 * Assign roles ensuring each role is filled and conflicts are minimized.
 * Uses greedy assignment: highest fit → first pick.
 */
function autoBalanceAssignment(suggestions: RoleSuggestion[]): Array<{ playerId: string; role: TableRole }> {
  const availableRoles = new Set<TableRole>(['CALLER', 'TREASURER', 'SABOTEUR', 'HISTORIAN']);
  const assignments: Array<{ playerId: string; role: TableRole }> = [];

  // Sort by fitScore desc — best fits get first pick
  const sorted = [...suggestions].sort((a, b) => b.fitScore - a.fitScore);

  for (const suggestion of sorted) {
    if (availableRoles.has(suggestion.suggestedRole)) {
      assignments.push({ playerId: suggestion.playerId, role: suggestion.suggestedRole });
      availableRoles.delete(suggestion.suggestedRole);
    } else if (suggestion.alternativeRole && availableRoles.has(suggestion.alternativeRole)) {
      assignments.push({ playerId: suggestion.playerId, role: suggestion.alternativeRole });
      availableRoles.delete(suggestion.alternativeRole);
    } else {
      // Fallback: assign any remaining role
      const fallback = [...availableRoles][0];
      if (fallback) {
        assignments.push({ playerId: suggestion.playerId, role: fallback });
        availableRoles.delete(fallback);
      }
    }
  }

  return assignments;
}

// ─── Conflict Prediction ──────────────────────────────────────────────────────

function predictConflict(players: PlayerRoleSignals[], suggestions: RoleSuggestion[]): ConflictPrediction {
  const avgToxicity = players.reduce((s, p) => s + p.toxicitySignal, 0) / Math.max(players.length, 1);
  const highSaboteurs = suggestions.filter(s => s.suggestedRole === 'SABOTEUR' || s.styleTags.includes('chaos-agent')).length;
  const avgAggression = players.reduce((s, p) => s + p.votePatternAggression, 0) / Math.max(players.length, 1);

  const riskScore = clamp(
    avgToxicity * 0.40 + (highSaboteurs / Math.max(players.length, 1)) * 0.30 + avgAggression * 0.30,
  );

  const riskLevel: ConflictRiskLevel = riskScore >= 0.65 ? 'HIGH' : riskScore >= 0.35 ? 'MEDIUM' : 'LOW';

  const drivers: string[] = [];
  if (avgToxicity > 0.4) drivers.push('elevated_toxicity');
  if (highSaboteurs > 1) drivers.push('multiple_chaotic_players');
  if (avgAggression > 0.6) drivers.push('high_aggression_pattern');

  const recommendedConsentMode: ConsentMode =
    riskLevel === 'HIGH' ? 'COMPETITIVE' :
    riskLevel === 'MEDIUM' ? 'GUIDED' : 'OPEN';

  return {
    riskLevel,
    riskScore,
    primaryDrivers: drivers,
    recommendedConsentMode,
    warningMessage: riskLevel === 'HIGH'
      ? 'High conflict risk — competitive mode recommended before run starts.'
      : null,
  };
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

function buildReceipt(
  request: TableRoleAssignmentRequest,
  assignments: Array<{ playerId: string; role: TableRole }>,
  suggestions: RoleSuggestion[],
  conflictRisk: ConflictRiskLevel,
): RoleAssignmentReceipt {
  const rationalePublicTags = [...new Set(suggestions.flatMap(s => s.styleTags))].slice(0, 5);
  const receiptHash = sha256(JSON.stringify({
    runSeed: request.runSeed,
    assignments,
    conflictRisk,
  })).slice(0, 24);

  return {
    runSeed: request.runSeed,
    assignments: assignments.map(a => ({
      playerId: a.playerId,
      role: a.role,
      fitScore: suggestions.find(s => s.playerId === a.playerId)?.fitScore ?? 0,
    })),
    conflictRisk,
    rationalePublicTags,
    receiptHash,
  };
}

// ─── Main Model ───────────────────────────────────────────────────────────────

export class M116a {
  private readonly mlEnabled: MlEnabled;
  private readonly boundedNudge: BoundedNudge;
  private readonly _auditHash: AuditHash;

  constructor(mlEnabled: MlEnabled, boundedNudge: BoundedNudge, auditHash: AuditHash) {
    this.mlEnabled = mlEnabled;
    this.boundedNudge = boundedNudge;
    this._auditHash = auditHash;
  }

  /**
   * Predict role fit scores for all players in a lobby.
   * Returns bounded [0,1] scores per player per role.
   */
  public async predictRoleFit(matchedRoles: string[], players: PlayerRoleSignals[]): Promise<number[]> {
    if (!this.mlEnabled.isEnabled()) return [];

    const scores = players.map(player => {
      const style = inferPlayerStyle(player);
      const role = matchedRoles[players.indexOf(player)] as TableRole | undefined;
      if (!role || !ROLE_STYLE_AFFINITY[role]) return 0;
      return roleFitScore(role, style, player);
    });

    return this.boundedNudge.nudge(scores);
  }

  /**
   * Full table role assignment with conflict prediction.
   * Returns suggestions, conflict analysis, auto-balanced assignment (if opted in), and receipt.
   */
  public async assignTableRoles(request: TableRoleAssignmentRequest): Promise<M116aOutput> {
    if (!this.mlEnabled.isEnabled()) {
      throw new Error('M116a: ML disabled — use manual role pick + static descriptions');
    }

    // Build suggestions per player
    const suggestions = buildRoleSuggestions(request.players);

    // Bound fit scores
    const boundedScores = this.boundedNudge.nudge(suggestions.map(s => s.fitScore));
    const boundedSuggestions = suggestions.map((s, i) => ({ ...s, fitScore: boundedScores[i] }));

    // Conflict prediction
    const conflictPrediction = predictConflict(request.players, boundedSuggestions);

    // Auto-balance assignment (if requested)
    const autoBalancedAssignment = request.preferAutoBalance
      ? autoBalanceAssignment(boundedSuggestions)
      : null;

    const assignments = autoBalancedAssignment ?? boundedSuggestions.map(s => ({ playerId: s.playerId, role: s.suggestedRole }));
    const receipt = buildReceipt(request, assignments, boundedSuggestions, conflictPrediction.riskLevel);

    const auditHash = this._auditHash.compute({
      runSeed: request.runSeed,
      rulesetVersion: request.rulesetVersion,
      playerCount: request.players.length,
      conflictRisk: conflictPrediction.riskLevel,
      assignmentHash: receipt.receiptHash,
      modelId: 'M116a',
    });

    return {
      suggestions: boundedSuggestions,
      conflictPrediction,
      autoBalancedAssignment,
      receipt,
      auditHash,
    };
  }

  public getAuditHash(): AuditHash {
    return this._auditHash;
  }
}

export { M116a as default };
