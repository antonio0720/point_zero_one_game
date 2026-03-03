/**
 * CoachModel — src/ml/CoachModel.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #9: Deterministic Coach Journal
 *
 * Generates cinematic, replay-consistent run journals from structured
 * run events. Deterministic from events — same events = same journal.
 * Optionally enriched by LLM but base layer is always deterministic.
 */

import type { KnowledgeState } from './KnowledgeTracer';
import type { DivergenceVerdict } from './DivergenceEngine';
import type { IntelligenceOutput } from './PlayerModelEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunJournalInput {
  mode:               string;
  grade:              string;
  totalScore:         number;
  survived:           boolean;
  finalCash:          number;
  finalNetWorth:      number;
  finalIncome:        number;
  totalTicks:         number;
  fubarHits:          number;
  wasEverInDistress:  boolean;
  recoveredFromDistress: boolean;
  biasActivations:    number;
  biasesCleared:      number;
  topCapability:      string;
  winStreak:          number;
  intel:              IntelligenceOutput;
  knowledgeStates:    KnowledgeState[];
  divergence?:        DivergenceVerdict;
  keyMomentLabels:    string[];   // top 3 key moments
  difficultyPreset:   string;
}

export interface RunJournal {
  headline:         string;
  openingLine:      string;
  bodyParagraphs:   string[];
  closingVerdict:   string;
  coachNote:        string;      // direct actionable advice
  pressureJournal:  string[];    // tick-level pressure narrative fragments
  caseFileId:       string;      // deterministic hash
}

// ─── Deterministic Journal Generator ─────────────────────────────────────────

function fnv32Hex(s: string): string {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const GRADE_OPENING: Record<string, string> = {
  S: 'You didn\'t just complete the run — you rewrote the parameters.',
  A: 'Clean system. Every decision had a reason. The numbers proved it.',
  B: 'Solid structure. Some gaps, but the foundation held.',
  C: 'You survived. The system bent but didn\'t break. Barely.',
  D: 'The pressure found you. Not everywhere, but in the places that mattered.',
  F: 'The system collapsed. This is the data you needed.',
};

const MODE_CONTEXT: Record<string, string> = {
  EMPIRE:    'Empire mode — pure cashflow accumulation against a rising tide of bots.',
  PREDATOR:  'Predator mode — counter-window timing and psyche management under fire.',
  SYNDICATE: 'Syndicate mode — co-op trust dynamics with defection risk on every tick.',
  PHANTOM:   'Phantom mode — ghost racing against a legend\'s VERIFIED trajectory.',
};

export function generateRunJournal(input: RunJournalInput): RunJournal {
  const {
    grade, survived, totalScore, finalCash, finalNetWorth,
    fubarHits, wasEverInDistress, recoveredFromDistress,
    biasActivations, biasesCleared, intel, knowledgeStates,
    divergence, keyMomentLabels, mode, difficultyPreset,
    topCapability, winStreak,
  } = input;

  // ── Headline ───────────────────────────────────────────────────────────────
  const headline = survived
    ? `${grade}-Grade Run · ${difficultyPreset} · ${MODE_CONTEXT[mode]?.split(' — ')[0] ?? mode}`
    : `SYSTEM FAILED · ${difficultyPreset} · ${MODE_CONTEXT[mode]?.split(' — ')[0] ?? mode}`;

  // ── Opening ────────────────────────────────────────────────────────────────
  const openingLine = GRADE_OPENING[grade] ?? 'The run is complete.';

  // ── Body ───────────────────────────────────────────────────────────────────
  const body: string[] = [];

  body.push(
    `${MODE_CONTEXT[mode] ?? ''} Final score: ${totalScore.toLocaleString()}. ` +
    `Net worth: $${Math.round(finalNetWorth / 1000)}K. Cash out: $${Math.round(finalCash / 1000)}K.`,
  );

  // Resilience narrative
  if (fubarHits > 0) {
    body.push(
      wasEverInDistress && recoveredFromDistress
        ? `${fubarHits} FUBAR events hit. You entered distress — and came back. That recovery is rare.`
        : wasEverInDistress
        ? `${fubarHits} FUBAR events hit. You entered distress and didn\'t recover. The shields weren\'t there.`
        : `${fubarHits} FUBAR events hit. Mitigations held. System stayed above the waterline.`,
    );
  }

  // Bias narrative
  if (biasActivations > 0) {
    const clearRate = biasActivations > 0 ? biasesCleared / biasActivations : 0;
    body.push(
      clearRate > 0.7
        ? `${biasActivations} bias activation(s) — cleared ${biasesCleared}. Behavioral discipline held.`
        : clearRate > 0.3
        ? `${biasActivations} bias activation(s) — only ${biasesCleared} cleared. Decision quality degraded mid-run.`
        : `${biasActivations} bias(es) active, ${biasesCleared} cleared. Cognitive load was a significant drag.`,
    );
  }

  // Intel narrative
  if (intel.tiltRisk > 0.5) {
    body.push(`Tilt risk peaked at ${Math.round(intel.tiltRisk * 100)}%. Speed degradation detected in late phases.`);
  }
  if (intel.bankruptcyRisk60 > 0.4) {
    body.push(`Bankruptcy proximity detected. Obligation coverage dropped dangerously close to 1.0× in crisis phase.`);
  }

  // Divergence narrative (Phantom only)
  if (divergence && divergence.totalGap > 0) {
    body.push(
      `Ghost gap: ${divergence.totalGap} CORD points. ${divergence.headline} ` +
      `Primary cause: ${divergence.primaryCause.label}.`,
    );
  }

  // Key moments
  if (keyMomentLabels.length > 0) {
    body.push(`Critical moments: ${keyMomentLabels.slice(0, 3).join(' → ')}.`);
  }

  // ── Closing Verdict ────────────────────────────────────────────────────────
  const closingVerdict = survived
    ? winStreak > 2
      ? `${winStreak}-run streak. Pattern recognition is compounding.`
      : `Run complete. The CORD record stands.`
    : divergence?.recoverable
    ? `Recoverable. One adjustment changes the outcome.`
    : `Start fresh. New seed, same principles.`;

  // ── Coach Note ────────────────────────────────────────────────────────────
  const weakest = [...knowledgeStates]
    .sort((a, b) => a.mastery - b.mastery)[0];

  const coachNote = weakest && weakest.mastery < 0.5
    ? `Focus next run: ${weakest.tag.replace(/_/g, ' ')} (mastery ${Math.round(weakest.mastery * 100)}%). ` +
      `This was your weakest principle under pressure.`
    : topCapability
    ? `Top capability this run: ${topCapability}. Build on that axis next run.`
    : `Review your zone selection — that\'s where the most recoverable CORD was left on the table.`;

  // ── Pressure Journal ──────────────────────────────────────────────────────
  const pressureJournal = buildPressureJournal(input);

  // ── Case File ID ──────────────────────────────────────────────────────────
  const caseFileId = fnv32Hex(
    `${grade}:${totalScore}:${finalNetWorth}:${fubarHits}:${biasActivations}`,
  );

  return { headline, openingLine, bodyParagraphs: body, closingVerdict, coachNote, pressureJournal, caseFileId };
}

function buildPressureJournal(input: RunJournalInput): string[] {
  const fragments: string[] = [];
  const ticksPerPhase = Math.floor(input.totalTicks / 5);

  const pressureByPhase = [
    input.intel.volatility < 0.3 ? 'Foundation phase — system stable, early plays landed.' : 'Foundation phase — volatile entry, early pressure detected.',
    input.intel.risk < 0.4 ? 'Momentum phase — cashflow building, no distress signals.' : 'Momentum phase — risk climbing, first cracks visible.',
    input.intel.tiltRisk > 0.4 ? 'Acceleration phase — tilt risk elevated, window timing degraded.' : 'Acceleration phase — maintained composure under acceleration.',
    input.wasEverInDistress ? 'Crisis phase — DISTRESS ENTERED.' : 'Crisis phase — held the line.',
    input.survived ? 'Collapse phase — survived the final compression.' : 'Collapse phase — system failure.',
  ];

  for (let i = 0; i < 5; i++) {
    fragments.push(`T${i * ticksPerPhase}–T${(i + 1) * ticksPerPhase}: ${pressureByPhase[i]}`);
  }

  return fragments;
}