#!/usr/bin/env python3
"""
PZO Engine Package — Resolve Remaining Imports
================================================
Run AFTER pzo_extract_engine.py to fix the 36 unresolved imports.

What this does:
  1. Copies 2 missed directories (contracts/, engine/)
  2. Creates 3 empire mode stubs (bleedMode, empireConfig, pressureJournalEngine)
  3. Creates 4 re-export shims (event-bus, modes/types, 2x CardUXBridge path fix)
  4. Re-runs verification

Usage:
  python3 pzo_resolve_imports.py --root /path/to/point_zero_one_master --apply
"""

from __future__ import annotations
import argparse, json, os, re, shutil, sys
from pathlib import Path
from typing import Dict, List

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", default=".")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()

    root = Path(args.root).resolve()
    pzo_src = root / "pzo-web" / "src"
    pkg_src = root / "frontend" / "packages" / "engine" / "src"
    dry = not args.apply

    if not pkg_src.exists():
        print(f"❌ Package not found at {pkg_src}. Run pzo_extract_engine.py first.")
        return 1

    created = 0
    copied = 0
    patched = 0

    def write(path: Path, content: str):
        nonlocal created
        path.parent.mkdir(parents=True, exist_ok=True)
        if not dry:
            path.write_text(content, encoding="utf-8")
        created += 1
        print(f"  CREATE: {path.relative_to(root)}")

    def copy_tree(src: Path, dst: Path):
        nonlocal copied
        if not src.exists():
            print(f"  ⚠ SOURCE MISSING: {src}")
            return
        if dst.exists() and not dry:
            shutil.rmtree(dst)
        if not dry:
            shutil.copytree(src, dst)
        count = sum(1 for _ in src.rglob("*") if _.is_file())
        copied += count
        print(f"  COPYTREE: {src.relative_to(root)} → {dst.relative_to(root)} ({count} files)")

    def patch_file(path: Path, old: str, new: str):
        nonlocal patched
        if not path.exists():
            print(f"  ⚠ PATCH TARGET MISSING: {path.relative_to(root)}")
            return
        text = path.read_text(encoding="utf-8")
        if old not in text:
            return
        if not dry:
            path.write_text(text.replace(old, new), encoding="utf-8")
        patched += 1
        print(f"  PATCH: {path.relative_to(root)}")

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"\n{'═'*60}")
    print(f"  PZO IMPORT RESOLVER — {mode}")
    print(f"{'═'*60}\n")

    # ─── 1. Copy missed directories ──────────────────────────────────────
    print("Step 1: Copying missed directories...")
    copy_tree(pzo_src / "contracts", pkg_src / "contracts")
    copy_tree(pzo_src / "engine", pkg_src / "engine")

    # Fix engine/resolver.ts imports (it imports from ../types/game and ../components/CardHand)
    resolver = pkg_src / "engine" / "resolver.ts"
    if resolver.exists():
        patch_file(resolver, "from '../types/game'", "from '../types/game'")  # already correct
        patch_file(resolver, "from '../components/CardHand'", "from '../components/CardHand'")  # already correct
        # But engine/ files use ../types/ which is now at same level
        # No fix needed — types/ was already copied to pkg_src/types/

    # ─── 2. Create empire mode stubs ─────────────────────────────────────
    print("\nStep 2: Creating empire mode stubs...")

    empire_dir = pkg_src / "game" / "modes" / "empire"

    # 2a. bleedMode.ts
    write(empire_dir / "bleedMode.ts", '''\
/**
 * bleedMode.ts — Empire Mode Bleed System
 * Point Zero One · Density6 LLC · Confidential
 *
 * Tracks passive wealth erosion ("bleeding") when expenses > income.
 * The bleed system creates urgency: players must achieve income > expenses
 * before their net worth drains to zero.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BleedSeverity = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'CRITICAL';

export interface BleedModeState {
  /** Whether the player is currently bleeding (expenses > income) */
  isActive:        boolean;
  /** Current severity level */
  severity:        BleedSeverity;
  /** Net drain per tick in dollars */
  drainPerTick:    number;
  /** Ticks since bleed started (0 if not active) */
  ticksActive:     number;
  /** Estimated ticks until bankruptcy at current drain rate */
  ticksToZero:     number;
  /** Peak severity reached this run */
  peakSeverity:    BleedSeverity;
}

// ─── Severity thresholds ──────────────────────────────────────────────────────

const SEVERITY_THRESHOLDS: Array<{ maxDrain: number; severity: BleedSeverity }> = [
  { maxDrain: 0,     severity: 'NONE' },
  { maxDrain: 200,   severity: 'LIGHT' },
  { maxDrain: 500,   severity: 'MODERATE' },
  { maxDrain: 1200,  severity: 'HEAVY' },
  { maxDrain: Infinity, severity: 'CRITICAL' },
];

// ─── Functions ────────────────────────────────────────────────────────────────

export function computeBleedSeverity(drainPerTick: number): BleedSeverity {
  for (const t of SEVERITY_THRESHOLDS) {
    if (drainPerTick <= t.maxDrain) return t.severity;
  }
  return 'CRITICAL';
}

export function estimatedSurvivalTicks(cash: number, netWorth: number, drainPerTick: number): number {
  if (drainPerTick <= 0) return Infinity;
  const available = Math.max(0, Math.min(cash, netWorth));
  return Math.floor(available / drainPerTick);
}

export function bleedDurationLabel(ticksActive: number): string {
  if (ticksActive < 10) return 'Just started';
  if (ticksActive < 50) return 'Building';
  if (ticksActive < 150) return 'Sustained';
  return 'Critical duration';
}

export function computeBleedUrgencyPulse(severity: BleedSeverity): number {
  switch (severity) {
    case 'NONE':     return 0;
    case 'LIGHT':    return 0.3;
    case 'MODERATE': return 0.6;
    case 'HEAVY':    return 0.85;
    case 'CRITICAL': return 1.0;
  }
}

export function createBleedState(): BleedModeState {
  return {
    isActive: false, severity: 'NONE', drainPerTick: 0,
    ticksActive: 0, ticksToZero: Infinity, peakSeverity: 'NONE',
  };
}

export function updateBleedState(
  state: BleedModeState, income: number, expenses: number,
  cash: number, netWorth: number,
): BleedModeState {
  const drain = Math.max(0, expenses - income);
  const isActive = drain > 0;
  const severity = computeBleedSeverity(drain);
  const ticksActive = isActive ? state.ticksActive + 1 : 0;
  const ticksToZero = estimatedSurvivalTicks(cash, netWorth, drain);
  const peakSeverity = SEVERITY_THRESHOLDS.findIndex(t => t.severity === severity)
    > SEVERITY_THRESHOLDS.findIndex(t => t.severity === state.peakSeverity)
    ? severity : state.peakSeverity;

  return { isActive, severity, drainPerTick: drain, ticksActive, ticksToZero, peakSeverity };
}
''')

    # 2b. empireConfig.ts
    write(empire_dir / "empireConfig.ts", '''\
/**
 * empireConfig.ts — Empire Mode Configuration
 * Point Zero One · Density6 LLC · Confidential
 *
 * Phase wave definitions, bleed severity visual configs, and
 * the getEmpireWave() helper that maps tick → current wave.
 */

import type { BleedSeverity } from './bleedMode';

// ─── Empire Wave Phases ───────────────────────────────────────────────────────

export interface EmpireWaveConfig {
  id:          string;
  label:       string;
  startTick:   number;
  endTick:     number;
  accent:      string;
  description: string;
}

export const EMPIRE_WAVES: EmpireWaveConfig[] = [
  { id: 'FOUNDATION',   label: 'Foundation',   startTick: 0,   endTick: 119,  accent: '#22DD88', description: 'Build your first income streams.' },
  { id: 'GROWTH',       label: 'Growth',       startTick: 120, endTick: 299,  accent: '#4A9EFF', description: 'Scale income past expenses.' },
  { id: 'PRESSURE',     label: 'Pressure',     startTick: 300, endTick: 499,  accent: '#FF9B2F', description: 'Adversaries escalate. Defend and grow.' },
  { id: 'SOVEREIGNTY',  label: 'Sovereignty',  startTick: 500, endTick: 719,  accent: '#C9A84C', description: 'Achieve financial independence.' },
];

export const EMPIRE_PHASE_ACCENTS: Record<string, string> = Object.fromEntries(
  EMPIRE_WAVES.map(w => [w.id, w.accent])
);

export function getEmpireWave(tick: number): EmpireWaveConfig {
  for (let i = EMPIRE_WAVES.length - 1; i >= 0; i--) {
    if (tick >= EMPIRE_WAVES[i].startTick) return EMPIRE_WAVES[i];
  }
  return EMPIRE_WAVES[0];
}

// ─── Bleed Severity Visual Config ─────────────────────────────────────────────

export const BLEED_SEVERITY_COLORS: Record<BleedSeverity, string> = {
  NONE:     '#22DD88',
  LIGHT:    '#FFD700',
  MODERATE: '#FF9B2F',
  HEAVY:    '#FF4D4D',
  CRITICAL: '#FF1744',
};

export const BLEED_SEVERITY_ICONS: Record<BleedSeverity, string> = {
  NONE:     '✅',
  LIGHT:    '⚠️',
  MODERATE: '🔶',
  HEAVY:    '🔴',
  CRITICAL: '💀',
};

export const BLEED_SEVERITY_LABELS: Record<BleedSeverity, string> = {
  NONE:     'Stable',
  LIGHT:    'Draining',
  MODERATE: 'Bleeding',
  HEAVY:    'Hemorrhaging',
  CRITICAL: 'Critical Bleed',
};
''')

    # 2c. pressureJournalEngine.ts
    write(empire_dir / "pressureJournalEngine.ts", '''\
/**
 * pressureJournalEngine.ts — Empire Mode Decision Journal
 * Point Zero One · Density6 LLC · Confidential
 *
 * Tracks and categorizes every player decision for the post-run
 * "Pressure Journal" — a cause-of-death / cause-of-victory analysis.
 */

// ─── Decision Tag Types ───────────────────────────────────────────────────────

export type DecisionTag =
  | 'INCOME_PLAY'
  | 'EXPENSE_CUT'
  | 'SHIELD_PLAY'
  | 'AGGRESSIVE_PLAY'
  | 'DEFENSIVE_PLAY'
  | 'MISSED_WINDOW'
  | 'FORCED_CARD'
  | 'OPTIMAL_TIMING'
  | 'POOR_TIMING'
  | 'RECOVERY_PLAY'
  | 'LEVERAGE_PLAY';

export const DECISION_TAG_COLORS: Record<DecisionTag, string> = {
  INCOME_PLAY:     '#22DD88',
  EXPENSE_CUT:     '#4A9EFF',
  SHIELD_PLAY:     '#00D4B8',
  AGGRESSIVE_PLAY: '#FF9B2F',
  DEFENSIVE_PLAY:  '#818CF8',
  MISSED_WINDOW:   '#FF4D4D',
  FORCED_CARD:     '#FF1744',
  OPTIMAL_TIMING:  '#C9A84C',
  POOR_TIMING:     '#FF6B6B',
  RECOVERY_PLAY:   '#A855F7',
  LEVERAGE_PLAY:   '#E040FB',
};

export const DECISION_TAG_ICONS: Record<DecisionTag, string> = {
  INCOME_PLAY:     '💰',
  EXPENSE_CUT:     '✂️',
  SHIELD_PLAY:     '🛡️',
  AGGRESSIVE_PLAY: '⚔️',
  DEFENSIVE_PLAY:  '🏰',
  MISSED_WINDOW:   '❌',
  FORCED_CARD:     '⚡',
  OPTIMAL_TIMING:  '🎯',
  POOR_TIMING:     '⏰',
  RECOVERY_PLAY:   '🔄',
  LEVERAGE_PLAY:   '📈',
};

// ─── Journal Entry ────────────────────────────────────────────────────────────

export interface PressureJournalEntry {
  tick:        number;
  cardId:      string;
  tag:         DecisionTag;
  impact:      number;
  description: string;
  wasForced:   boolean;
}

export function tagDecision(
  cardType: string, wasForced: boolean, incomeEffect: number, expenseEffect: number,
): DecisionTag {
  if (wasForced) return 'FORCED_CARD';
  if (incomeEffect > 0) return 'INCOME_PLAY';
  if (expenseEffect < 0) return 'EXPENSE_CUT';
  if (cardType.includes('SHIELD')) return 'SHIELD_PLAY';
  if (incomeEffect > 500) return 'AGGRESSIVE_PLAY';
  return 'DEFENSIVE_PLAY';
}
''')

    # ─── 3. Create re-export shims ───────────────────────────────────────
    print("\nStep 3: Creating re-export shims...")

    # 3a. core/event-bus.ts → re-export from types
    write(pkg_src / "core" / "event-bus.ts", '''\
/**
 * event-bus.ts — Re-export shim
 * PZOEventType and PressureEventInterface are defined in ./types.ts.
 * This file exists because EventBus.ts imports from './event-bus'.
 */
export type { PZOEventType } from './types';

// PressureEventInterface is used as a generic constraint.
// Broadened to object in EventBus.ts v3, so we export a compatible type.
export interface PressureEventInterface {
  [key: string]: unknown;
}
''')

    # 3b. modes/types.ts → re-export from ../cards/types
    #     PredatorCardMode and SyndicateCardMode import from '../types' but mean cards/types
    #     Fix: rewrite the imports directly to ../cards/types (cleaner than a shim)
    pred = pkg_src / "modes" / "PredatorCardMode.ts"
    patch_file(pred, "from '../types'", "from '../cards/types'")

    synd = pkg_src / "modes" / "SyndicateCardMode.ts"
    patch_file(synd, "from '../types'", "from '../cards/types'")

    # Same issue in time/TickRateInterpolator.ts
    tick_interp = pkg_src / "time" / "TickRateInterpolator.ts"
    if tick_interp.exists():
        text = tick_interp.read_text(encoding="utf-8")
        if "from '../types'" in text:
            # This one wants core/types, not cards/types
            patch_file(tick_interp, "from '../types'", "from '../core/types'")

    # 3c. Fix CardUXBridge import path in PredatorCardMode and SyndicateCardMode
    #     They import from '../CardUXBridge' but it's at '../cards/CardUXBridge'
    patch_file(pred, "from '../CardUXBridge'", "from '../cards/CardUXBridge'")
    patch_file(synd, "from '../CardUXBridge'", "from '../cards/CardUXBridge'")

    # 3d. Copy CardHand.tsx — missed by extraction script, referenced by 3+ files
    cardhand_src = pzo_src / "components" / "CardHand.tsx"
    cardhand_dst = pkg_src / "components" / "CardHand.tsx"
    if cardhand_src.exists() and not cardhand_dst.exists():
        cardhand_dst.parent.mkdir(parents=True, exist_ok=True)
        if not dry:
            shutil.copy2(cardhand_src, cardhand_dst)
        copied += 1
        print(f"  COPY: CardHand.tsx → components/ (was missing)")

    # 3e. Fix CardHand.tsx imports (../engines/X → ../X)
    if cardhand_dst.exists():
        patch_file(cardhand_dst, "../engines/", "../")

    # 3f. Remove stale modes/types.ts shim if it exists (imports fixed directly above)
    stale_shim = pkg_src / "modes" / "types.ts"
    if stale_shim.exists():
        if not dry:
            stale_shim.unlink()
        print(f"  DELETE: modes/types.ts (stale shim — imports fixed directly)")

    # ─── 4. Fix engine/ imports that reference outside ───────────────────
    print("\nStep 4: Fixing engine/ directory imports...")

    # engine/resolver.ts imports from ../types/game and ../components/CardHand
    # Both are at the correct relative path from engine/ since types/ and components/ are siblings
    # But engine/ files might reference ../engines/ which no longer exists
    for f in (pkg_src / "engine").rglob("*.ts"):
        text = f.read_text(encoding="utf-8")
        if "../engines/" in text:
            if not dry:
                f.write_text(text.replace("../engines/", "../"), encoding="utf-8")
            patched += 1
            print(f"  PATCH: {f.relative_to(root)} (../engines/ → ../)")

    # ─── 5. Fix contracts import in time/SeasonClock ─────────────────────
    print("\nStep 5: Fixing contracts import path...")
    # SeasonClock imports from '../contracts' — in old layout that went up to engines/ then to contracts/
    # In new layout, time/ is at src/time/, contracts/ is at src/contracts/
    # So '../contracts' is correct! But let's verify.
    season_clock = pkg_src / "time" / "SeasonClock.ts"
    if season_clock.exists():
        text = season_clock.read_text(encoding="utf-8")
        if "../contracts" in text:
            print(f"  ✓ SeasonClock → ../contracts (already correct)")

    # ─── 6. Summary ──────────────────────────────────────────────────────
    print(f"\n{'═'*60}")
    print(f"  SUMMARY")
    print(f"{'═'*60}")
    print(f"  Files created: {created}")
    print(f"  Files copied:  {copied}")
    print(f"  Files patched: {patched}")
    print(f"{'═'*60}\n")

    # ─── 7. Re-verify ────────────────────────────────────────────────────
    if args.apply:
        print("Re-running verification...")
        os.system(f'python3 {root}/pzo_extract_engine.py --root {root} --verify-only')

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
