/**
 * PZO SPRINT 6 — src/components/ProofCardV2.tsx
 *
 * Enhanced ProofCard with full scoring decomposition:
 *   MONEY SCORE     — cashflow, net worth, income coverage
 *   RESILIENCE SCORE — survived shocks, shields used, distress recovery
 *   DISCIPLINE SCORE — bias avoidance, zone correctness, obligation coverage
 *   RISK MGMT SCORE  — typed mitigations, diversification, hubris control
 *
 * Also shows:
 *   - Objective badges with XP earned
 *   - Capability gains timeline
 *   - Key decision moments (top 5 plays)
 *   - Shareable summary line
 *   - "How you won" / "How you lost" narrative
 *   - Match hash (for anti-cheat verification in Sprint 8)
 */

'use client';

import { useMemo, useState } from 'react';
import type {
  CapabilityState,
  ReputationState,
  PortfolioRecord,
  ObjectiveId,
} from '../types/game';
import { OBJECTIVE_CONFIGS } from '../types/game';

// ─── Score Computation ────────────────────────────────────────────────────────

export interface RunScoringInput {
  // Raw financials
  finalCash: number;
  finalNetWorth: number;
  finalIncome: number;
  finalExpenses: number;
  startingCash: number;

  // Resilience signals
  totalFubarHits: number;
  fubarsAbsorbed: number;
  wasEverInDistress: boolean;
  recoveredFromDistress: boolean;
  bankruptcyTick: number | null;

  // Discipline signals
  biasActivations: number;
  biasesCleared: number;
  wrongZonePlays: number;
  correctZonePlays: number;
  obligationCoverage: number;
  decisionFatigueEvents: number;

  // Risk management signals
  mitigationsUsed: number;
  mitigationTypes: string[];
  finalHhi: number;
  peakHubrisMeter: number;
  hubrisEvents: number;

  // Meta
  totalTicks: number;
  totalPlays: number;
  objectives: ObjectiveId[];
  completedObjectives: ObjectiveId[];
  capabilities: CapabilityState;
  reputation: ReputationState;
  portfolio: PortfolioRecord[];
  keyMoments: KeyMoment[];
  runSeed: number;
  difficultyPreset: 'INTRO' | 'STANDARD' | 'BRUTAL';
}

export interface KeyMoment {
  tick: number;
  type: 'play' | 'fubar' | 'recovery' | 'maturity' | 'bias' | 'objective';
  label: string;
  cashDelta: number;
  cashflowDelta: number;
  explanation: string;
}

export interface ScoringBreakdown {
  moneyScore: number;
  resilienceScore: number;
  disciplineScore: number;
  riskMgmtScore: number;
  objectiveBonus: number;
  difficultyMultiplier: number;
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  shareableTag: string;
  narrative: string;
}

const CAPABILITY_LABELS_MAP: Record<keyof CapabilityState, string> = {
  underwriting: 'Underwriting',
  negotiation: 'Negotiation',
  bookkeeping: 'Bookkeeping',
  marketing: 'Marketing',
  compliance: 'Compliance',
  analytics: 'Analytics',
  systems: 'Systems',
};

const DIFFICULTY_MULT: Record<string, number> = {
  INTRO: 0.7,
  STANDARD: 1.0,
  BRUTAL: 1.5,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computeScoring(input: RunScoringInput): ScoringBreakdown {
  // ── Money Score (0–1000) ──────────────────────────────────────────────────
  const cashflowRatio = input.finalIncome / Math.max(1, input.finalExpenses);
  const netWorthGrowth =
    (input.finalNetWorth - input.startingCash) / Math.max(1, input.startingCash);

  const moneyRaw =
    clamp(cashflowRatio / 3, 0, 1) * 400 +
    (clamp(netWorthGrowth, 0, 3) / 3) * 400 +
    clamp(input.finalCash / 50_000, 0, 1) * 200;

  const moneyScore = Math.round(clamp(moneyRaw, 0, 1000));

  // ── Resilience Score (0–1000) ─────────────────────────────────────────────
  const survivalBonus = input.bankruptcyTick === null ? 300 : 0;
  const absorptionRate =
    input.totalFubarHits > 0 ? input.fubarsAbsorbed / input.totalFubarHits : 1;
  const recoveryBonus =
    input.wasEverInDistress && input.recoveredFromDistress ? 200 : 0;

  const resilienceRaw =
    survivalBonus +
    absorptionRate * 300 +
    recoveryBonus +
    clamp((12 - input.totalFubarHits) / 12, 0, 1) * 200;

  const resilienceScore = Math.round(clamp(resilienceRaw, 0, 1000));

  // ── Discipline Score (0–1000) ──────────────────────────────────────────────
  const biasControl =
    input.biasActivations > 0 ? input.biasesCleared / input.biasActivations : 1;

  const zoneAccuracy =
    input.correctZonePlays + input.wrongZonePlays > 0
      ? input.correctZonePlays /
        (input.correctZonePlays + input.wrongZonePlays)
      : 0.5;

  const oblCoverage = clamp(input.obligationCoverage, 0, 2) / 2;

  const disciplineRaw =
    biasControl * 350 +
    zoneAccuracy * 350 +
    oblCoverage * 200 +
    clamp((5 - input.decisionFatigueEvents) / 5, 0, 1) * 100;

  const disciplineScore = Math.round(clamp(disciplineRaw, 0, 1000));

  // ── Risk Management Score (0–1000) ────────────────────────────────────────
  const diversification = clamp(1 - input.finalHhi, 0, 1);
  const mitigationBreadth = clamp(input.mitigationTypes.length / 4, 0, 1);
  const hubrisControl = clamp((100 - input.peakHubrisMeter) / 100, 0, 1);

  const riskMgmtRaw =
    diversification * 350 +
    mitigationBreadth * 350 +
    hubrisControl * 200 +
    clamp((3 - input.hubrisEvents) / 3, 0, 1) * 100;

  const riskMgmtScore = Math.round(clamp(riskMgmtRaw, 0, 1000));

  // ── Objective Bonus ───────────────────────────────────────────────────────
  const objectiveBonus = input.completedObjectives.reduce((sum, id) => {
    return sum + (OBJECTIVE_CONFIGS[id]?.bonusXp ?? 0);
  }, 0);

  // ── Total ─────────────────────────────────────────────────────────────────
  const difficultyMultiplier = DIFFICULTY_MULT[input.difficultyPreset] ?? 1.0;
  const rawTotal =
    (moneyScore + resilienceScore + disciplineScore + riskMgmtScore) / 4;

  const totalScore = Math.round((rawTotal + objectiveBonus) * difficultyMultiplier);

  // ── Grade ─────────────────────────────────────────────────────────────────
  const grade: ScoringBreakdown['grade'] =
    totalScore >= 900 ? 'S' :
    totalScore >= 750 ? 'A' :
    totalScore >= 600 ? 'B' :
    totalScore >= 450 ? 'C' :
    totalScore >= 300 ? 'D' : 'F';

  // ── Narrative ─────────────────────────────────────────────────────────────
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (moneyScore >= 700) strengths.push('elite capital builder');
  if (resilienceScore >= 700) strengths.push('shock-resistant operator');
  if (disciplineScore >= 700) strengths.push('disciplined executor');
  if (riskMgmtScore >= 700) strengths.push('sophisticated risk architect');

  if (moneyScore < 300) weaknesses.push('weak cashflow engine');
  if (resilienceScore < 300) weaknesses.push('fragile under pressure');
  if (disciplineScore < 300) weaknesses.push('behavior-driven losses');
  if (riskMgmtScore < 300) weaknesses.push('unprotected downside');

  const narrative =
    grade === 'S' || grade === 'A'
      ? `You ran a clean system. ${strengths.join(', ')}. ${input.recoveredFromDistress ? 'The comeback made it legendary.' : ''}`
      : grade === 'F'
      ? `The system collapsed. ${weaknesses.join(', ')}. You know what to fix. Run it back.`
      : `Mixed run. Strong: ${strengths.join(', ') || 'none'}. Exposed: ${weaknesses.join(', ') || 'none'}.`;

  // ── Shareable Tag ─────────────────────────────────────────────────────────
  const bestDimension = ([
    ['Money', moneyScore],
    ['Resilience', resilienceScore],
    ['Discipline', disciplineScore],
    ['Risk IQ', riskMgmtScore],
  ] as [string, number][]).sort((a, b) => b[1] - a[1])[0][0];

  const shareableTag = `PZO ${grade} | ${bestDimension} ${Math.round(Math.max(moneyScore, resilienceScore, disciplineScore, riskMgmtScore) / 10)} | ${input.difficultyPreset}`;

  return {
    moneyScore,
    resilienceScore,
    disciplineScore,
    riskMgmtScore,
    objectiveBonus,
    difficultyMultiplier,
    totalScore,
    grade,
    shareableTag,
    narrative,
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function ScorePillar({
  label,
  score,
  icon,
  color,
  breakdown,
}: {
  label: string;
  score: number;
  icon: string;
  color: string;
  breakdown: string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const fillPct = (score / 1000) * 100;

  const tierLabel =
    score >= 800 ? 'ELITE' :
    score >= 600 ? 'STRONG' :
    score >= 400 ? 'AVERAGE' :
    score >= 200 ? 'WEAK' : 'CRITICAL';

  const tierColor =
    score >= 800 ? 'text-emerald-400' :
    score >= 600 ? 'text-indigo-400' :
    score >= 400 ? 'text-zinc-300' :
    score >= 200 ? 'text-orange-400' : 'text-red-400';

  return (
    <div
      className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3 cursor-pointer hover:border-zinc-500 transition-all"
      onClick={() => setShowBreakdown(v => !v)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{icon}</span>
          <span className="text-white text-xs font-bold">{label}</span>
        </div>
        <div className="text-right">
          <span className={`font-black text-lg font-mono ${color}`}>{score}</span>
          <span className="text-zinc-600 text-xs font-mono">/1000</span>
        </div>
      </div>

      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full rounded-full transition-all ${color.replace('text-', 'bg-')}`}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <span className={`text-xs font-bold ${tierColor}`}>{tierLabel}</span>
        <span className="text-zinc-600 text-xs">{showBreakdown ? '▲ hide' : '▼ why'}</span>
      </div>

      {showBreakdown && (
        <p className="text-zinc-400 text-xs mt-2 leading-relaxed border-t border-zinc-700/50 pt-2">
          {breakdown}
        </p>
      )}
    </div>
  );
}

function KeyMomentRow({ moment }: { moment: KeyMoment }) {
  const typeIcon: Record<KeyMoment['type'], string> = {
    play: '🃏',
    fubar: '💥',
    recovery: '🔄',
    maturity: '💰',
    bias: '🧠',
    objective: '🎯',
  };

  const typeColor: Record<KeyMoment['type'], string> = {
    play: 'text-indigo-300',
    fubar: 'text-red-400',
    recovery: 'text-yellow-400',
    maturity: 'text-emerald-400',
    bias: 'text-orange-400',
    objective: 'text-purple-400',
  };

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0">
      <span className="text-xs text-zinc-600 w-10 shrink-0 font-mono">T{moment.tick}</span>
      <span className="text-sm">{typeIcon[moment.type]}</span>
      <div className="flex-1">
        <p className={`text-xs font-semibold ${typeColor[moment.type]}`}>{moment.label}</p>
        <p className="text-zinc-500 text-xs leading-tight">{moment.explanation}</p>
      </div>
      <div className="text-right shrink-0">
        {moment.cashDelta !== 0 && (
          <p className={`text-xs font-mono ${moment.cashDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {moment.cashDelta > 0 ? '+' : ''}
            {fmt(moment.cashDelta)}
          </p>
        )}
        {moment.cashflowDelta !== 0 && (
          <p className={`text-xs font-mono ${moment.cashflowDelta > 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
            {moment.cashflowDelta > 0 ? '+' : ''}
            {fmt(moment.cashflowDelta)}/mo
          </p>
        )}
      </div>
    </div>
  );
}

function ObjectiveBadgeResult({ id, completed }: { id: ObjectiveId; completed: boolean }) {
  const config = OBJECTIVE_CONFIGS[id];

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
        completed
          ? 'bg-emerald-900/20 border-emerald-700/50'
          : 'bg-zinc-800/40 border-zinc-700/50 opacity-50'
      }`}
    >
      <span className="text-sm">{completed ? '✅' : '❌'}</span>
      <div className="flex-1">
        <p className={`text-xs font-bold ${completed ? 'text-emerald-300' : 'text-zinc-500'}`}>
          {config.badgeLabel}
        </p>
        <p className="text-zinc-500 text-xs">{config.description}</p>
      </div>
      {completed && (
        <span className="text-emerald-400 text-xs font-bold font-mono">+{config.bonusXp}xp</span>
      )}
    </div>
  );
}

// ─── Main ProofCardV2 ─────────────────────────────────────────────────────────

export interface ProofCardV2Props {
  input: RunScoringInput;
  matchHash?: string;
  onRestart?: () => void;
  onShare?: (tag: string) => void;
  onExport?: () => void;
}

export default function ProofCardV2({
  input,
  matchHash,
  onRestart,
  onShare,
  onExport,
}: ProofCardV2Props) {
  const scoring = useMemo(() => computeScoring(input), [input]);
  const [activeTab, setActiveTab] = useState<'overview' | 'moments' | 'portfolio' | 'capabilities'>('overview');

  const cashflow = input.finalIncome - input.finalExpenses;
  const won = cashflow > 0 && input.bankruptcyTick === null;

  const gradeStyles: Record<ScoringBreakdown['grade'], { color: string; glow: string; bg: string }> = {
    S: { color: 'text-yellow-300', glow: 'shadow-yellow-500/20', bg: 'from-yellow-900/30 to-zinc-900' },
    A: { color: 'text-emerald-400', glow: 'shadow-emerald-500/20', bg: 'from-emerald-900/30 to-zinc-900' },
    B: { color: 'text-blue-400', glow: 'shadow-blue-500/20', bg: 'from-blue-900/30 to-zinc-900' },
    C: { color: 'text-zinc-300', glow: 'shadow-none', bg: 'from-zinc-800/50 to-zinc-900' },
    D: { color: 'text-orange-400', glow: 'shadow-orange-500/20', bg: 'from-orange-900/20 to-zinc-900' },
    F: { color: 'text-red-400', glow: 'shadow-red-500/30', bg: 'from-red-900/30 to-zinc-900' },
  };

  const gradeStyle = gradeStyles[scoring.grade];

  return (
    <div
      className={`bg-gradient-to-b ${gradeStyle.bg} border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl ${gradeStyle.glow} max-w-2xl mx-auto`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 text-center border-b border-zinc-800">
        <div className={`text-7xl font-black tracking-tighter ${gradeStyle.color} mb-1`}>{scoring.grade}</div>
        <div className="text-white font-black text-xl mb-0.5">{won ? 'SYSTEM BUILT' : 'SYSTEM FAILED'}</div>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">{scoring.narrative}</p>

        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">Total Score</p>
            <p className="text-white font-black text-2xl font-mono">{scoring.totalScore.toLocaleString()}</p>
          </div>

          <div className="w-px h-10 bg-zinc-700" />

          <div className="text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">Difficulty</p>
            <p className="text-indigo-300 font-bold text-sm">{input.difficultyPreset}</p>
            <p className="text-zinc-600 text-xs">×{scoring.difficultyMultiplier.toFixed(1)}</p>
          </div>

          <div className="w-px h-10 bg-zinc-700" />

          <div className="text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">Objectives</p>
            <p className="text-purple-300 font-bold text-sm">
              {input.completedObjectives.length}/{input.objectives.length}
            </p>
            {scoring.objectiveBonus > 0 && <p className="text-purple-500 text-xs">+{scoring.objectiveBonus}xp</p>}
          </div>
        </div>

        {matchHash && <p className="text-zinc-700 text-xs font-mono mt-2 truncate">#{matchHash}</p>}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-800">
        {(['overview', 'moments', 'portfolio', 'capabilities'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-indigo-500 bg-zinc-800/40'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'overview' ? '📊 Scores' :
             tab === 'moments' ? '⚡ Moments' :
             tab === 'portfolio' ? '🏦 Portfolio' : '⚙️ Skills'}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-4">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <ScorePillar
                label="Money"
                score={scoring.moneyScore}
                icon="💵"
                color="text-emerald-400"
                breakdown={`Cashflow coverage: ${(input.finalIncome / Math.max(1, input.finalExpenses)).toFixed(2)}×. Net worth growth: ${fmt(input.finalNetWorth - input.startingCash)}. Final cash: ${fmt(input.finalCash)}.`}
              />
              <ScorePillar
                label="Resilience"
                score={scoring.resilienceScore}
                icon="🛡"
                color="text-blue-400"
                breakdown={`Survived: ${input.bankruptcyTick === null ? 'yes' : 'no'}. FUBAR absorbed: ${input.fubarsAbsorbed}/${input.totalFubarHits}. Recovered from distress: ${input.recoveredFromDistress ? 'yes' : input.wasEverInDistress ? 'no' : 'never needed to'}.`}
              />
              <ScorePillar
                label="Discipline"
                score={scoring.disciplineScore}
                icon="🧠"
                color="text-purple-400"
                breakdown={`Biases cleared: ${input.biasesCleared}/${input.biasActivations}. Zone accuracy: ${input.correctZonePlays}/${input.correctZonePlays + input.wrongZonePlays} plays. Obligation coverage: ${input.obligationCoverage.toFixed(2)}×.`}
              />
              <ScorePillar
                label="Risk IQ"
                score={scoring.riskMgmtScore}
                icon="⚖️"
                color="text-orange-400"
                breakdown={`Diversification HHI: ${(input.finalHhi * 100).toFixed(0)}% concentration. Mitigation types used: ${input.mitigationTypes.join(', ') || 'none'}. Peak hubris: ${input.peakHubrisMeter}/100.`}
              />
            </div>

            <div className="bg-zinc-800/60 rounded-xl p-3 grid grid-cols-3 gap-3">
              {[
                ['Final Cash', fmt(input.finalCash), input.finalCash > 0 ? 'text-emerald-400' : 'text-red-400'],
                ['Net Worth', fmt(input.finalNetWorth), 'text-white'],
                ['Income/mo', fmt(input.finalIncome), 'text-emerald-400'],
                ['Expenses/mo', fmt(input.finalExpenses), 'text-red-400'],
                ['Cashflow', `${cashflow >= 0 ? '+' : ''}${fmt(cashflow)}`, cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'],
                ['Rep Tier', input.reputation.tier, 'text-indigo-300'],
              ].map(([label, val, color]) => (
                <div key={label as string}>
                  <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
                  <p className={`font-bold font-mono text-sm ${color}`}>{val}</p>
                </div>
              ))}
            </div>

            {input.objectives.length > 0 && (
              <div>
                <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">Run Objectives</p>
                <div className="space-y-1.5">
                  {input.objectives.map(id => (
                    <ObjectiveBadgeResult key={id} id={id} completed={input.completedObjectives.includes(id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MOMENTS TAB */}
        {activeTab === 'moments' && (
          <div>
            <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">
              Key Decision Moments ({input.keyMoments.length})
            </p>
            {input.keyMoments.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-6">No key moments recorded.</p>
            ) : (
              <div>
                {input.keyMoments
                  .sort((a, b) => Math.abs(b.cashDelta + b.cashflowDelta * 12) - Math.abs(a.cashDelta + a.cashflowDelta * 12))
                  .slice(0, 8)
                  .map((m, i) => (
                    <KeyMomentRow key={i} moment={m} />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* PORTFOLIO TAB */}
        {activeTab === 'portfolio' && (
          <div className="space-y-2">
            <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">
              Final Portfolio ({input.portfolio.length} assets)
            </p>
            {input.portfolio.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-6">No assets held at run end.</p>
            ) : (
              input.portfolio.map(p => (
                <div key={p.cardId} className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-white text-xs font-semibold">{p.cardName}</p>
                    <p className="text-zinc-500 text-xs capitalize">{p.assetClass} · {p.zone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 text-xs font-mono">+{fmt(p.monthlyIncome)}/mo</p>
                    <p className="text-zinc-400 text-xs font-mono">{fmt(p.value)} value</p>
                  </div>
                </div>
              ))
            )}

            <div
              className={`rounded-xl px-3 py-2 border ${
                input.finalHhi < 0.35 ? 'bg-emerald-900/20 border-emerald-800/40' :
                input.finalHhi < 0.6  ? 'bg-yellow-900/20 border-yellow-800/40' :
                                        'bg-red-900/20 border-red-800/40'
              }`}
            >
              <p className="text-zinc-400 text-xs">
                Portfolio concentration:{' '}
                <span className="font-bold font-mono">{(input.finalHhi * 100).toFixed(0)}% HHI</span>
                {input.finalHhi < 0.35 ? ' — diversified' : input.finalHhi < 0.6 ? ' — moderate' : ' — concentrated (risk amplified)'}
              </p>
            </div>
          </div>
        )}

        {/* CAPABILITIES TAB */}
        {activeTab === 'capabilities' && (
          <div className="space-y-3">
            <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">Capability Gains</p>

            <div className="space-y-2">
              {(Object.entries(input.capabilities) as [keyof CapabilityState, number][]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="text-zinc-400 text-xs w-28">{CAPABILITY_LABELS_MAP[k]}</span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${v >= 7 ? 'bg-purple-500' : v >= 4 ? 'bg-indigo-500' : 'bg-zinc-600'}`}
                      style={{ width: `${(v / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-zinc-300 text-xs font-mono w-8 text-right">{v}/10</span>
                </div>
              ))}
            </div>

            <div className="bg-zinc-800/60 rounded-xl p-3">
              <div className="flex justify-between mb-1">
                <span className="text-zinc-400 text-xs font-semibold">Reputation</span>
                <span className="text-indigo-300 text-xs font-bold">{input.reputation.tier}</span>
              </div>
              <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full"
                  style={{ width: `${(input.reputation.score / 1000) * 100}%` }}
                />
              </div>
              <p className="text-zinc-600 text-xs mt-1">{input.reputation.score}/1000 rep</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 flex gap-2 border-t border-zinc-800 pt-3">
        {onShare && (
          <button
            onClick={() => onShare(scoring.shareableTag)}
            className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors border border-zinc-700"
          >
            📤 Share Proof
          </button>
        )}

        {onExport && (
          <button
            onClick={onExport}
            className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors border border-zinc-700"
          >
            📋 Export Card
          </button>
        )}

        {onRestart && (
          <button
            onClick={onRestart}
            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black transition-colors"
          >
            Run it Back
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const s = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1_000) return `${s}$${(v / 1e3).toFixed(0)}K`;
  return `${s}$${v.toLocaleString()}`;
}