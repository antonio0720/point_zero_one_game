/**
 * WindowMasteryTracker — src/ml/WindowMasteryTracker.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #12: Per-Window Mastery Rating
 *
 * Tracks mastery across all 4 timing window types:
 *   FATE   — Empire forced events
 *   CTR    — Predator counter windows
 *   GBM    — Phantom ghost beat markers
 *   PHZ    — Empire phase transition windows
 *
 * Mastery is a prestige stat players grind — it represents real skill.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WindowType = 'FATE' | 'CTR' | 'GBM' | 'PHZ';

export interface WindowResult {
  type:          WindowType;
  tick:          number;
  pressureTier:  1 | 2 | 3 | 4 | 5;
  resolved:      boolean;
  autoResolved:  boolean;
  responseMs:    number;
  wasOptimal:    boolean;   // resolved in first 50% of window
  speedScore:    number;    // 0–100
}

export interface WindowMastery {
  type:              WindowType;
  label:             string;
  masteryPct:        number;       // 0–100 displayable
  tier:              'NOVICE' | 'APPRENTICE' | 'PROFICIENT' | 'EXPERT' | 'MASTER';
  totalAttempts:     number;
  totalResolved:     number;
  optimalRate:       number;       // fraction resolved optimally
  avgResponseMs:     number;
  pressureResolved:  number;       // resolved under tier 3+
  streakBest:        number;       // best consecutive optimal streak
  xpEarned:          number;       // season XP contribution
}

const WINDOW_LABELS: Record<WindowType, string> = {
  FATE: 'FATE Window (Empire)',
  CTR:  'Counter Window (Predator)',
  GBM:  'Ghost Beat Marker (Phantom)',
  PHZ:  'Phase Transition (Empire)',
};

// ─── Mastery Tier Thresholds ──────────────────────────────────────────────────
// masteryPct → tier label

function toTier(pct: number): WindowMastery['tier'] {
  if (pct >= 85) return 'MASTER';
  if (pct >= 70) return 'EXPERT';
  if (pct >= 50) return 'PROFICIENT';
  if (pct >= 25) return 'APPRENTICE';
  return 'NOVICE';
}

// ─── Tracker ─────────────────────────────────────────────────────────────────

export class WindowMasteryTracker {
  private results = new Map<WindowType, WindowResult[]>();
  private streaks = new Map<WindowType, { current: number; best: number }>();

  record(result: WindowResult): void {
    if (!this.results.has(result.type)) {
      this.results.set(result.type, []);
      this.streaks.set(result.type, { current: 0, best: 0 });
    }

    this.results.get(result.type)!.push(result);

    const streak = this.streaks.get(result.type)!;
    if (result.wasOptimal) {
      streak.current++;
      if (streak.current > streak.best) streak.best = streak.current;
    } else {
      streak.current = 0;
    }
  }

  getMastery(type: WindowType): WindowMastery {
    const results  = this.results.get(type) ?? [];
    const streakRec = this.streaks.get(type) ?? { current: 0, best: 0 };

    if (results.length === 0) {
      return {
        type, label: WINDOW_LABELS[type],
        masteryPct: 0, tier: 'NOVICE',
        totalAttempts: 0, totalResolved: 0, optimalRate: 0,
        avgResponseMs: 0, pressureResolved: 0,
        streakBest: 0, xpEarned: 0,
      };
    }

    const resolved         = results.filter(r => r.resolved && !r.autoResolved);
    const optimal          = results.filter(r => r.wasOptimal);
    const pressureResolved = results.filter(r => r.pressureTier >= 3 && r.resolved && !r.autoResolved);
    const totalMs          = resolved.reduce((s, r) => s + r.responseMs, 0);
    const avgResponseMs    = resolved.length > 0 ? totalMs / resolved.length : 0;
    const optimalRate      = results.length > 0 ? optimal.length / results.length : 0;

    // Mastery formula:
    //   40% resolution rate
    //   30% optimal rate (speed)
    //   20% high-pressure resolution
    //   10% streak bonus
    const resRate      = resolved.length / results.length;
    const pressRate    = pressureResolved.length / Math.max(1, results.filter(r => r.pressureTier >= 3).length);
    const streakBonus  = Math.min(1, streakRec.best / 10);
    const masteryRaw   = resRate * 40 + optimalRate * 30 + pressRate * 20 + streakBonus * 10;
    const masteryPct   = Math.round(Math.min(100, masteryRaw));

    // XP: 5 per resolution, 3 bonus for optimal, 8 for high-pressure
    const xpEarned =
      resolved.length * 5 +
      optimal.length * 3 +
      pressureResolved.length * 8;

    return {
      type,
      label:          WINDOW_LABELS[type],
      masteryPct,
      tier:           toTier(masteryPct),
      totalAttempts:  results.length,
      totalResolved:  resolved.length,
      optimalRate,
      avgResponseMs:  Math.round(avgResponseMs),
      pressureResolved: pressureResolved.length,
      streakBest:     streakRec.best,
      xpEarned,
    };
  }

  getAllMastery(): WindowMastery[] {
    const types: WindowType[] = ['FATE', 'CTR', 'GBM', 'PHZ'];
    return types.map(t => this.getMastery(t));
  }

  /** Total mastery XP across all window types */
  getTotalXp(): number {
    return this.getAllMastery().reduce((s, m) => s + m.xpEarned, 0);
  }
}