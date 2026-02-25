// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/counterplayWindowEngine.ts
// Sprint 4 — Counterplay Window System
//
// When an extraction fires, a timed counterplay window opens.
// Defender chooses: BLOCK | REFLECT | DAMPEN | ABSORB | (timeout = NONE)
// Window expires after counterplayWindowTicks — unresolved = LANDED.
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';
import type { ExtractionAction, CounterplayAction } from './extractionEngine';

export interface CounterplayWindow {
  id: string;
  extraction: ExtractionAction;
  openedAtTick: number;
  expiresAtTick: number;
  resolved: boolean;
  chosenAction: CounterplayAction | null;
  resolvedAtTick: number | null;
  /** Available options based on defender's current state */
  availableOptions: CounterplayOption[];
}

export interface CounterplayOption {
  action: CounterplayAction;
  label: string;
  description: string;
  bbCost: number;
  cashCost: number;
  available: boolean;
  unavailableReason?: string;
}

export interface CounterplayContext {
  defenderCash: number;
  defenderShields: number;
  defenderBB: number;
  defenderIncome: number;
  psycheValue: number;
}

// ─── Build Window ─────────────────────────────────────────────────────────────

export function buildCounterplayWindow(
  extraction: ExtractionAction,
  currentTick: number,
  ctx: CounterplayContext,
): CounterplayWindow {
  const options = buildOptions(extraction, ctx);

  return {
    id: `cpw-${extraction.id}`,
    extraction,
    openedAtTick: currentTick,
    expiresAtTick: currentTick + PREDATOR_CONFIG.counterplayWindowTicks,
    resolved: false,
    chosenAction: null,
    resolvedAtTick: null,
    availableOptions: options,
  };
}

// ─── Option Builder ───────────────────────────────────────────────────────────

function buildOptions(
  extraction: ExtractionAction,
  ctx: CounterplayContext,
): CounterplayOption[] {
  const { defenderCash, defenderShields, defenderBB, psycheValue } = ctx;

  const blockCost = Math.round(Math.abs(extraction.rawCashImpact) * 0.5);
  const reflectCost = Math.round(Math.abs(extraction.rawCashImpact) * 0.25);
  const dampenCost = Math.round(Math.abs(extraction.rawCashImpact) * 0.15);
  const tilted = psycheValue >= PREDATOR_CONFIG.tiltActivationThreshold;

  return [
    {
      action: 'BLOCK',
      label: 'Full Block',
      description: 'Negate extraction entirely',
      bbCost: 60,
      cashCost: blockCost,
      available: defenderBB >= 60 && defenderCash >= blockCost && !tilted,
      unavailableReason: tilted ? 'Cannot block while tilted'
        : defenderBB < 60 ? 'Insufficient battle budget'
        : 'Insufficient cash',
    },
    {
      action: 'REFLECT',
      label: 'Reflect',
      description: 'Send 50% impact back at attacker',
      bbCost: 80,
      cashCost: 0,
      available: defenderBB >= 80 && !tilted,
      unavailableReason: tilted ? 'Cannot reflect while tilted' : 'Insufficient battle budget',
    },
    {
      action: 'DAMPEN',
      label: 'Dampen',
      description: 'Reduce impact by 60%',
      bbCost: 30,
      cashCost: dampenCost,
      available: defenderBB >= 30 && defenderCash >= dampenCost,
      unavailableReason: defenderBB < 30 ? 'Insufficient battle budget' : 'Insufficient cash',
    },
    {
      action: 'ABSORB',
      label: 'Shield Absorb',
      description: 'Use a shield to negate all impact',
      bbCost: 0,
      cashCost: 0,
      available: defenderShields > 0,
      unavailableReason: 'No shields available',
    },
    {
      action: 'NONE',
      label: 'Accept',
      description: 'Take full impact — recover later',
      bbCost: 0,
      cashCost: 0,
      available: true,
    },
  ];
}

// ─── Resolve ──────────────────────────────────────────────────────────────────

export function resolveCounterplayWindow(
  window: CounterplayWindow,
  action: CounterplayAction,
  currentTick: number,
): CounterplayWindow {
  return {
    ...window,
    resolved: true,
    chosenAction: action,
    resolvedAtTick: currentTick,
  };
}

export function isWindowExpired(window: CounterplayWindow, currentTick: number): boolean {
  return !window.resolved && currentTick >= window.expiresAtTick;
}
