/**
 * useM42GuidedPrompts — hook for M42 Guided Prompts (Opt-In, Minimal, Non-Preachy)
 * Source spec: mechanics/M42_guided_prompts_opt_in_minimal.md
 *
 * Prompts highlight mechanics, not morality.
 * Fade out as mastery is demonstrated (anti-handholding).
 * Scoped to active run; expire with the run.
 *
 * Deploy to: pzo-web/src/mechanics/useM42GuidedPrompts.ts
 */

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PromptTrigger =
  | 'TIMER_LOW'             // <20% of turn window remaining
  | 'HEAT_RISING'           // portfolio heat >0.6
  | 'EXIT_WINDOW_OPEN'      // Opportunity Window active
  | 'NO_LIQUID_RUNG'        // ladder has no INSTANT or SHORT slot
  | 'INERTIA_HIGH'          // inertia > 3.0
  | 'MACRO_DECAY_ACTIVE'    // final 2 minutes
  | 'FIRST_FUBAR'           // player's first FUBAR card
  | 'SHIELD_AVAILABLE'      // player has shield buff unused
  | 'LOAN_DENIED'           // player just got loan denied
  | 'WIN_CONDITION_CLOSE';  // passive income within 20% of expenses

export interface GuidedPrompt {
  promptId: string;
  trigger: PromptTrigger;
  message: string;
  priority: number;       // 1 (highest) – 5 (lowest)
  dismissable: boolean;
  autoFadeMs: number;     // ms until auto-dismiss; 0 = no auto-fade
  shown: boolean;
  dismissed: boolean;
  completedAt: number | null; // null = not completed
}

export interface M42GameSignals {
  turnWindowRemainingFraction: number;  // 0–1
  portfolioHeat: number;                // 0–1
  exitWindowOpen: boolean;
  hasLiquidRung: boolean;
  inertia: number;
  macroDecayActive: boolean;
  isFirstFubar: boolean;
  hasShieldBuff: boolean;
  loanJustDenied: boolean;
  passiveIncome: number;
  monthlyExpenses: number;
  runSeed: string;
  rulesetVersion: string;
  tickIndex: number;
  masteryScore: number;   // 0–1; derived from session performance; higher = fewer prompts
}

export interface M42State {
  prompts: GuidedPrompt[];
  auditHash: string;
  sessionPromptsShown: number;
  masteryThreshold: number;  // prompts suppressed above this mastery level
  mlEnabled: boolean;
}

type M42Action =
  | { type: 'PROMPT_SHOWN'; promptId: string }
  | { type: 'PROMPT_DISMISSED'; promptId: string; tick: number }
  | { type: 'PROMPT_COMPLETED'; promptId: string; tick: number }
  | { type: 'PROMPTS_EVALUATED'; prompts: GuidedPrompt[]; auditHash: string }
  | { type: 'MASTERY_UPDATED'; masteryScore: number };

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mastery score above which prompts stop appearing (earned, not time-based). */
const MASTERY_SUPPRESS_THRESHOLD = 0.75;

/** Max prompts shown per session (anti-annoyance). */
const MAX_PROMPTS_PER_SESSION = 8;

/** Each prompt shown reduces the "remaining budget" for the session. */
const SESSION_PROMPT_BUDGET = 8;

// ─── Prompt Catalog ───────────────────────────────────────────────────────────

const PROMPT_CATALOG: Record<PromptTrigger, Omit<GuidedPrompt, 'promptId' | 'shown' | 'dismissed' | 'completedAt'>> = {
  TIMER_LOW: {
    trigger: 'TIMER_LOW',
    message: '⏱ Timer low — make your move or the turn expires.',
    priority: 1,
    dismissable: true,
    autoFadeMs: 8_000,
  },
  HEAT_RISING: {
    trigger: 'HEAT_RISING',
    message: '🔥 Portfolio heat rising — overconcentration increases forced-sale risk.',
    priority: 2,
    dismissable: true,
    autoFadeMs: 10_000,
  },
  EXIT_WINDOW_OPEN: {
    trigger: 'EXIT_WINDOW_OPEN',
    message: '📈 Exit window open — flip now or wait for the next pulse.',
    priority: 2,
    dismissable: true,
    autoFadeMs: 12_000,
  },
  NO_LIQUID_RUNG: {
    trigger: 'NO_LIQUID_RUNG',
    message: '💧 No liquid rung — if an opportunity hits, you may miss the bag.',
    priority: 3,
    dismissable: true,
    autoFadeMs: 0,
  },
  INERTIA_HIGH: {
    trigger: 'INERTIA_HIGH',
    message: '⚠️ Hesitation is stacking — Missed Opportunity odds increasing.',
    priority: 2,
    dismissable: true,
    autoFadeMs: 8_000,
  },
  MACRO_DECAY_ACTIVE: {
    trigger: 'MACRO_DECAY_ACTIVE',
    message: '⏳ Final stretch — macro decay draining cash each second. Act fast.',
    priority: 1,
    dismissable: false,
    autoFadeMs: 0,
  },
  FIRST_FUBAR: {
    trigger: 'FIRST_FUBAR',
    message: '💥 FUBAR drawn — shields cancel it. Build shields with PRIVILEGED cards.',
    priority: 3,
    dismissable: true,
    autoFadeMs: 12_000,
  },
  SHIELD_AVAILABLE: {
    trigger: 'SHIELD_AVAILABLE',
    message: '🛡 Shield active — next FUBAR is blocked automatically.',
    priority: 4,
    dismissable: true,
    autoFadeMs: 6_000,
  },
  LOAN_DENIED: {
    trigger: 'LOAN_DENIED',
    message: '🚫 Loan denied — cash purchases only for the next few turns.',
    priority: 2,
    dismissable: true,
    autoFadeMs: 10_000,
  },
  WIN_CONDITION_CLOSE: {
    trigger: 'WIN_CONDITION_CLOSE',
    message: '🏁 Passive income almost covers expenses — one more deal and you escape.',
    priority: 1,
    dismissable: true,
    autoFadeMs: 15_000,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function buildAuditHash(signals: M42GameSignals, activePromptIds: string[]): string {
  return sha256hex(JSON.stringify({
    runSeed: signals.runSeed,
    rulesetVersion: signals.rulesetVersion,
    tickIndex: signals.tickIndex,
    activePromptIds,
    masteryScore: signals.masteryScore,
  })).slice(0, 32);
}

function buildPromptId(trigger: PromptTrigger, runSeed: string, tickIndex: number): string {
  return sha256hex(`prompt:${trigger}:${runSeed}:${tickIndex}`).slice(0, 16);
}

// ─── Trigger Evaluation ───────────────────────────────────────────────────────

function evaluateTriggers(signals: M42GameSignals): PromptTrigger[] {
  const triggers: PromptTrigger[] = [];

  if (signals.turnWindowRemainingFraction < 0.20) triggers.push('TIMER_LOW');
  if (signals.portfolioHeat > 0.60) triggers.push('HEAT_RISING');
  if (signals.exitWindowOpen) triggers.push('EXIT_WINDOW_OPEN');
  if (!signals.hasLiquidRung) triggers.push('NO_LIQUID_RUNG');
  if (signals.inertia > 3.0) triggers.push('INERTIA_HIGH');
  if (signals.macroDecayActive) triggers.push('MACRO_DECAY_ACTIVE');
  if (signals.isFirstFubar) triggers.push('FIRST_FUBAR');
  if (signals.hasShieldBuff) triggers.push('SHIELD_AVAILABLE');
  if (signals.loanJustDenied) triggers.push('LOAN_DENIED');

  const winProximity = signals.monthlyExpenses > 0
    ? signals.passiveIncome / signals.monthlyExpenses
    : 0;
  if (winProximity >= 0.80 && winProximity < 1.0) triggers.push('WIN_CONDITION_CLOSE');

  // Sort by priority
  return triggers.sort((a, b) => PROMPT_CATALOG[a].priority - PROMPT_CATALOG[b].priority);
}

/**
 * Build the active prompts list from signals.
 * Mastery suppression: at high mastery, only priority-1 prompts shown.
 */
function buildPromptsFromSignals(
  signals: M42GameSignals,
  existingPrompts: GuidedPrompt[],
  sessionPromptsShown: number,
  mlEnabled: boolean,
): GuidedPrompt[] {
  if (!mlEnabled) return [];
  if (sessionPromptsShown >= SESSION_PROMPT_BUDGET) return existingPrompts;

  const triggers = evaluateTriggers(signals);
  const masteryFilter = signals.masteryScore >= MASTERY_SUPPRESS_THRESHOLD
    ? (t: PromptTrigger) => PROMPT_CATALOG[t].priority <= 1
    : () => true;

  const activePrompts: GuidedPrompt[] = [];
  const existingTriggers = new Set(existingPrompts.filter(p => !p.dismissed && p.shown).map(p => p.trigger));

  for (const trigger of triggers.filter(masteryFilter)) {
    // Don't re-show a prompt that's already active
    if (existingTriggers.has(trigger)) {
      const existing = existingPrompts.find(p => p.trigger === trigger && !p.dismissed);
      if (existing) activePrompts.push(existing);
      continue;
    }

    const catalog = PROMPT_CATALOG[trigger];
    const prompt: GuidedPrompt = {
      promptId: buildPromptId(trigger, signals.runSeed, signals.tickIndex),
      ...catalog,
      shown: false,
      dismissed: false,
      completedAt: null,
    };
    activePrompts.push(prompt);
  }

  return activePrompts;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function m42Reducer(state: M42State, action: M42Action): M42State {
  switch (action.type) {
    case 'PROMPTS_EVALUATED':
      return { ...state, prompts: action.prompts, auditHash: action.auditHash };

    case 'PROMPT_SHOWN': {
      const prompts = state.prompts.map(p =>
        p.promptId === action.promptId ? { ...p, shown: true } : p,
      );
      return { ...state, prompts, sessionPromptsShown: state.sessionPromptsShown + 1 };
    }

    case 'PROMPT_DISMISSED': {
      const prompts = state.prompts.map(p =>
        p.promptId === action.promptId ? { ...p, dismissed: true, completedAt: action.tick } : p,
      );
      return { ...state, prompts };
    }

    case 'PROMPT_COMPLETED': {
      const prompts = state.prompts.map(p =>
        p.promptId === action.promptId ? { ...p, dismissed: true, completedAt: action.tick } : p,
      );
      return { ...state, prompts };
    }

    case 'MASTERY_UPDATED': {
      const threshold = action.masteryScore >= MASTERY_SUPPRESS_THRESHOLD
        ? MASTERY_SUPPRESS_THRESHOLD
        : state.masteryThreshold;
      return { ...state, masteryThreshold: threshold };
    }

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseM42GuidedPromptsReturn {
  prompts: GuidedPrompt[];
  visiblePrompts: GuidedPrompt[];
  auditHash: string;
  dismissPrompt: (promptId: string) => void;
  completePrompt: (promptId: string) => void;
  markPromptShown: (promptId: string) => void;
  sessionPromptsShown: number;
}

export function useM42GuidedPrompts(
  signals: M42GameSignals | null,
  mlEnabled = true,
): UseM42GuidedPromptsReturn {
  const initialState: M42State = {
    prompts: [],
    auditHash: '',
    sessionPromptsShown: 0,
    masteryThreshold: MASTERY_SUPPRESS_THRESHOLD,
    mlEnabled,
  };

  const [state, dispatch] = useReducer(m42Reducer, initialState);

  // Evaluate prompts whenever signals change
  useEffect(() => {
    if (!signals || !mlEnabled) return;

    const newPrompts = buildPromptsFromSignals(
      signals,
      state.prompts,
      state.sessionPromptsShown,
      mlEnabled,
    );

    const auditHash = buildAuditHash(signals, newPrompts.map(p => p.promptId));

    dispatch({ type: 'PROMPTS_EVALUATED', prompts: newPrompts, auditHash });
    dispatch({ type: 'MASTERY_UPDATED', masteryScore: signals.masteryScore });
  }, [
    signals?.tickIndex,
    signals?.portfolioHeat,
    signals?.turnWindowRemainingFraction,
    signals?.exitWindowOpen,
    signals?.macroDecayActive,
    signals?.inertia,
    mlEnabled,
  ]);

  const dismissPrompt = useCallback((promptId: string) => {
    dispatch({ type: 'PROMPT_DISMISSED', promptId, tick: Date.now() });
  }, []);

  const completePrompt = useCallback((promptId: string) => {
    dispatch({ type: 'PROMPT_COMPLETED', promptId, tick: Date.now() });
  }, []);

  const markPromptShown = useCallback((promptId: string) => {
    dispatch({ type: 'PROMPT_SHOWN', promptId });
  }, []);

  const visiblePrompts = useMemo(
    () => state.prompts.filter(p => !p.dismissed),
    [state.prompts],
  );

  return {
    prompts: state.prompts,
    visiblePrompts,
    auditHash: state.auditHash,
    dismissPrompt,
    completePrompt,
    markPromptShown,
    sessionPromptsShown: state.sessionPromptsShown,
  };
}

export default useM42GuidedPrompts;
