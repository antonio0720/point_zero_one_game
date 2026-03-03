/**
 * BehavioralAnomalyDetector — src/ml/BehavioralAnomalyDetector.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #7: ML Behavioral Sequence Anomaly Detection
 *
 * Ensemble approach:
 *   1. Sequence autoencoder (LSTM-lite via sliding window reconstruction error)
 *   2. One-class boundary check (human-like play envelope)
 *   3. Per-mode baseline comparison (Predator ≠ Phantom behavior norms)
 *
 * Replaces/extends the heuristic timing/frequency checks in antiCheat.ts
 * with a unified confidence score and explainable verdict.
 */

import type { SessionAction } from '../types/club';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export interface AnomalyReport {
  isAnomaly:       boolean;
  confidence:      number;        // 0–1, how confident we are it's human
  anomalyScore:    number;        // 0–1, higher = more bot-like
  flags:           AnomalyFlag[];
  verdict:         'HUMAN' | 'SUSPICIOUS' | 'BOT_LIKELY';
  explanation:     string;
}

export interface AnomalyFlag {
  type:     'TIMING' | 'FREQUENCY' | 'SEQUENCE' | 'MODE_BASELINE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  detail:   string;
}

// ─── Per-Mode Baselines ───────────────────────────────────────────────────────
// Derived from expected human behavior per mode

interface ModeBaseline {
  minAvgResponseMs:  number;
  maxPlaysPerMinute: number;
  expectedMissRate:  [number, number];  // [min, max] normal range
  counterWindowMs:   number;            // typical counter window duration
}

const MODE_BASELINES: Record<GameMode, ModeBaseline> = {
  EMPIRE:    { minAvgResponseMs: 800,  maxPlaysPerMinute: 4,  expectedMissRate: [0.05, 0.35], counterWindowMs: 6000 },
  PREDATOR:  { minAvgResponseMs: 600,  maxPlaysPerMinute: 5,  expectedMissRate: [0.10, 0.40], counterWindowMs: 4000 },
  SYNDICATE: { minAvgResponseMs: 1000, maxPlaysPerMinute: 3,  expectedMissRate: [0.05, 0.30], counterWindowMs: 7000 },
  PHANTOM:   { minAvgResponseMs: 900,  maxPlaysPerMinute: 4,  expectedMissRate: [0.08, 0.38], counterWindowMs: 5000 },
};

// ─── Sliding Window Reconstruction Error (LSTM-lite) ─────────────────────────
// We encode each action as a feature vector and compute reconstruction error
// using a simple autoencoder approximation (mean deviation from expected pattern)

function encodeAction(action: SessionAction, prevAction: SessionAction | null): number[] {
  const timeDelta  = prevAction ? (action.timestamp - prevAction.timestamp) : 0;
  const tickDelta  = prevAction ? (action.tick - prevAction.tick) : 0;
  const typeHash   = (action.type.length * 31 + action.tick) % 100 / 100;
  return [
    Math.min(1, timeDelta / 10000),   // normalized time delta
    Math.min(1, tickDelta / 50),       // normalized tick delta
    typeHash,                          // action type signal
  ];
}

function reconstructionError(window: number[][]): number {
  if (window.length < 3) return 0;
  const mean = window[0].map((_, i) => window.reduce((s, v) => s + v[i], 0) / window.length);
  const errors = window.map(vec =>
    vec.reduce((s, v, i) => s + Math.abs(v - mean[i]), 0) / vec.length,
  );
  return errors.reduce((s, v) => s + v, 0) / errors.length;
}

// ─── Detector ────────────────────────────────────────────────────────────────

export class BehavioralAnomalyDetector {
  private readonly windowSize = 8;

  analyze(
    log:      SessionAction[],
    mode:     GameMode = 'EMPIRE',
    baseline: ModeBaseline = MODE_BASELINES[mode],
  ): AnomalyReport {
    const flags: AnomalyFlag[] = [];

    if (log.length < 5) {
      return { isAnomaly: false, confidence: 0.5, anomalyScore: 0, flags: [], verdict: 'HUMAN', explanation: 'Insufficient data' };
    }

    // ── 1. Timing Analysis ────────────────────────────────────────────────────
    const resolveActions = log.filter(a => a.type === 'window_resolved');
    if (resolveActions.length >= 3) {
      const responseTimes = resolveActions.map(a => {
        const openedAt = a.payload?.openedAtMs as number | undefined;
        return openedAt ? a.timestamp - openedAt : baseline.counterWindowMs;
      });

      const avgResponse   = responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length;
      const minResponse   = Math.min(...responseTimes);
      const subHumanCount = responseTimes.filter(t => t < baseline.minAvgResponseMs).length;
      const subHumanRate  = subHumanCount / responseTimes.length;

      if (minResponse < baseline.minAvgResponseMs * 0.5) {
        flags.push({ type: 'TIMING', severity: 'HIGH',
          detail: `Min response ${minResponse}ms — half the ${mode} human threshold (${baseline.minAvgResponseMs}ms)` });
      } else if (subHumanRate > 0.4) {
        flags.push({ type: 'TIMING', severity: 'MEDIUM',
          detail: `${Math.round(subHumanRate * 100)}% of window responses below ${mode} baseline` });
      }

      if (avgResponse < baseline.minAvgResponseMs) {
        flags.push({ type: 'MODE_BASELINE', severity: 'MEDIUM',
          detail: `Avg response ${Math.round(avgResponse)}ms vs ${mode} baseline min ${baseline.minAvgResponseMs}ms` });
      }
    }

    // ── 2. Frequency Analysis ─────────────────────────────────────────────────
    const playActions = log.filter(a => a.type === 'card_played');
    if (playActions.length >= 4) {
      let maxBurst = 0;
      for (let i = 0; i < playActions.length; i++) {
        const windowStart = playActions[i].timestamp;
        let count = 1;
        for (let j = i + 1; j < playActions.length; j++) {
          if (playActions[j].timestamp - windowStart <= 60_000) count++;
          else break;
        }
        if (count > maxBurst) maxBurst = count;
      }

      if (maxBurst > baseline.maxPlaysPerMinute * 2) {
        flags.push({ type: 'FREQUENCY', severity: 'HIGH',
          detail: `${maxBurst} plays/min burst — ${mode} human max is ${baseline.maxPlaysPerMinute}/min` });
      } else if (maxBurst > baseline.maxPlaysPerMinute * 1.5) {
        flags.push({ type: 'FREQUENCY', severity: 'MEDIUM',
          detail: `${maxBurst} plays/min — above ${mode} expected range` });
      }
    }

    // ── 3. Sequence Reconstruction Error ─────────────────────────────────────
    const encoded: number[][] = [];
    for (let i = 0; i < log.length; i++) {
      encoded.push(encodeAction(log[i], i > 0 ? log[i - 1] : null));
    }

    let maxReconError = 0;
    for (let i = 0; i <= encoded.length - this.windowSize; i++) {
      const window = encoded.slice(i, i + this.windowSize);
      const err = reconstructionError(window);
      if (err < 0.02 && window.length >= this.windowSize) {
        // Very low reconstruction error = too consistent = bot pattern
        maxReconError = Math.max(maxReconError, 1 - err * 50);
        flags.push({ type: 'SEQUENCE', severity: 'MEDIUM',
          detail: `Suspiciously uniform action pattern at log index ${i}–${i + this.windowSize}` });
        break; // one flag per run is enough
      }
    }

    // ── Composite Score ───────────────────────────────────────────────────────
    const highCount   = flags.filter(f => f.severity === 'HIGH').length;
    const medCount    = flags.filter(f => f.severity === 'MEDIUM').length;
    const anomalyScore = Math.min(1, highCount * 0.35 + medCount * 0.15 + maxReconError * 0.2);
    const confidence  = Math.max(0, 1 - anomalyScore);

    const verdict: AnomalyReport['verdict'] =
      anomalyScore > 0.65 ? 'BOT_LIKELY' :
      anomalyScore > 0.30 ? 'SUSPICIOUS' : 'HUMAN';

    const explanation = verdict === 'HUMAN'
      ? `Behavior consistent with human ${mode} play patterns.`
      : verdict === 'BOT_LIKELY'
      ? `Pattern matches bot-like micro-bursts during ${mode} windows. ${flags.length} anomalies detected.`
      : `${flags.length} minor anomaly(s) detected. Likely human — monitor.`;

    return { isAnomaly: anomalyScore > 0.30, confidence, anomalyScore, flags, verdict, explanation };
  }
}