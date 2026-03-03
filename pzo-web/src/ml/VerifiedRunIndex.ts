/**
 * VerifiedRunIndex — src/ml/VerifiedRunIndex.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #15: Verified Run Explorer ML Layer
 *
 * Indexes VERIFIED runs by:
 *   - educational principles learned
 *   - timing mastery dimensions
 *   - bot counter patterns
 *   - skill signature proximity
 *
 * Transforms the leaderboard into a search engine for mastery.
 * "Find me the run that teaches leverage risk under CRISIS pressure."
 */

import type { SkillSignature } from './RunEmbedder';
import type { WindowMastery }  from './WindowMasteryTracker';
import type { KnowledgeState } from './KnowledgeTracer';
import { cosineSimilarity }    from './RunEmbedder';
import { fnv32Hex }            from '../engine/antiCheat';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export interface VerifiedRunRecord {
  /** Canonical CORD proof ID */
  runId:              string;
  playerId:           string;
  displayName:        string;
  mode:               GameMode;
  grade:              string;
  totalScore:         number;
  cordScore:          number;
  seasonId:           string;
  /** Unix ms */
  completedAt:        number;
  /** Skill signature embedding */
  signature:          SkillSignature;
  /** Per-window mastery at run completion */
  windowMastery:      WindowMastery[];
  /** Knowledge states at run completion */
  knowledgeStates:    KnowledgeState[];
  /** Tags that had mastery gain > 0.1 this run */
  principlesLearned:  string[];
  /** Bot counter patterns demonstrated (e.g. 'counter_fubar_t4', 'bias_clear_streak') */
  counterPatterns:    string[];
  /** FNV hash of (runId + cordScore + grade) — tamper check */
  entryHash:          string;
}

export interface RunSearchQuery {
  /** Find runs where this principle was learned/demonstrated */
  principle?:         string;
  /** Find runs with mastery above threshold in this window type */
  windowType?:        'FATE' | 'CTR' | 'GBM' | 'PHZ';
  windowMasteryMin?:  number;      // 0–100
  /** Find runs demonstrating this bot counter pattern */
  counterPattern?:    string;
  /** Find runs similar to the given signature */
  similarToSignature?: SkillSignature;
  similarityMin?:     number;      // 0–1 cosine similarity floor
  mode?:              GameMode;
  gradeMin?:          'F' | 'D' | 'C' | 'B' | 'A' | 'S';
  /** Limit results */
  topN?:              number;
}

export interface RunSearchResult {
  run:          VerifiedRunRecord;
  relevanceScore: number;         // 0–1 composite
  matchReasons:   string[];
}

export interface IndexStats {
  totalRuns:         number;
  byMode:            Record<GameMode, number>;
  byGrade:           Record<string, number>;
  topPrinciples:     string[];    // most-learned principles across all runs
  uniquePlayers:     number;
}

// ─── Grade Ordering ───────────────────────────────────────────────────────────

const GRADE_ORDER: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

function gradeAtLeast(run: VerifiedRunRecord, min: string): boolean {
  return (GRADE_ORDER[run.grade] ?? 0) >= (GRADE_ORDER[min] ?? 0);
}

// ─── Entry Hash Builder ───────────────────────────────────────────────────────

export function buildEntryHash(run: Omit<VerifiedRunRecord, 'entryHash'>): string {
  const canonical = `${run.runId}|${run.cordScore}|${run.grade}|${run.playerId}|${run.completedAt}`;
  return `VR-${fnv32Hex(canonical)}`;
}

// ─── Verified Run Index ───────────────────────────────────────────────────────

export class VerifiedRunIndex {
  private runs: VerifiedRunRecord[] = [];

  // ── Ingestion ────────────────────────────────────────────────────────────────

  add(run: VerifiedRunRecord): void {
    const expected = buildEntryHash(run);
    if (run.entryHash !== expected) {
      throw new Error(
        `[VerifiedRunIndex] Entry hash mismatch for run ${run.runId}. ` +
        `Expected ${expected}, got ${run.entryHash}. Run rejected.`,
      );
    }
    // Deduplicate by runId
    if (!this.runs.find(r => r.runId === run.runId)) {
      this.runs.push(run);
    }
  }

  addBatch(runs: VerifiedRunRecord[]): { added: number; rejected: number; errors: string[] } {
    let added = 0, rejected = 0;
    const errors: string[] = [];
    for (const run of runs) {
      try {
        this.add(run);
        added++;
      } catch (e) {
        rejected++;
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { added, rejected, errors };
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  search(query: RunSearchQuery): RunSearchResult[] {
    let candidates = [...this.runs];

    // Hard filters
    if (query.mode) {
      candidates = candidates.filter(r => r.mode === query.mode);
    }
    if (query.gradeMin) {
      candidates = candidates.filter(r => gradeAtLeast(r, query.gradeMin!));
    }

    // Score each candidate
    const scored = candidates.map(run => {
      let score = 0;
      const reasons: string[] = [];

      // Principle match
      if (query.principle) {
        const learned = run.principlesLearned.includes(query.principle);
        const knowledge = run.knowledgeStates.find(k => k.tag === query.principle);
        if (learned) {
          score += 0.40;
          reasons.push(`Learned ${query.principle} this run`);
        } else if (knowledge && knowledge.mastery > 0.6) {
          score += 0.20;
          reasons.push(`High mastery in ${query.principle} (${Math.round(knowledge.mastery * 100)}%)`);
        }
      }

      // Window mastery match
      if (query.windowType !== undefined) {
        const wm = run.windowMastery.find(w => w.type === query.windowType);
        if (wm) {
          const min = query.windowMasteryMin ?? 50;
          if (wm.masteryPct >= min) {
            const bonus = wm.masteryPct / 100;
            score += 0.30 * bonus;
            reasons.push(`${query.windowType} mastery: ${wm.masteryPct}% (${wm.tier})`);
          }
        }
      }

      // Counter pattern match
      if (query.counterPattern) {
        if (run.counterPatterns.includes(query.counterPattern)) {
          score += 0.20;
          reasons.push(`Demonstrates ${query.counterPattern}`);
        }
      }

      // Skill signature similarity
      if (query.similarToSignature) {
        const sim = cosineSimilarity(
          run.signature.vector,
          query.similarToSignature.vector,
        );
        const min = query.similarityMin ?? 0.7;
        if (sim >= min) {
          score += 0.10 * sim;
          reasons.push(`Skill signature match: ${Math.round(sim * 100)}% similar`);
        }
      }

      // Grade quality bonus
      score += (GRADE_ORDER[run.grade] ?? 0) / 5 * 0.10;

      return { run, relevanceScore: Math.min(1, score), matchReasons: reasons };
    });

    return scored
      .filter(r => r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, query.topN ?? 10);
  }

  // ── Principle Lookup ─────────────────────────────────────────────────────────

  /**
   * "Find me the run that best teaches X"
   * Returns top run demonstrating the given principle under high pressure.
   */
  findBestTeacher(principle: string, mode?: GameMode): VerifiedRunRecord | null {
    const results = this.search({
      principle,
      mode,
      gradeMin: 'B',
      topN: 1,
    });
    return results[0]?.run ?? null;
  }

  /**
   * Find runs that target the given skill dimension weaknesses.
   * Used by ghost recommender to find adversarial matchups.
   */
  findGhostsByWeakness(
    weakDimensions: string[],
    mode: GameMode,
    topN = 3,
  ): VerifiedRunRecord[] {
    const candidates = this.runs.filter(r => r.mode === mode);

    // Prefer runs where the player was strong in the weak dimensions
    const scored = candidates.map(run => {
      let score = 0;
      for (const dim of weakDimensions) {
        const sigDim = run.signature.dimensions.find(d => d.name === dim);
        if (sigDim) score += sigDim.value;
      }
      return { run, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(s => s.run);
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  getStats(): IndexStats {
    const byMode: Record<string, number>  = {};
    const byGrade: Record<string, number> = {};
    const principleCount: Record<string, number> = {};
    const playerSet = new Set<string>();

    for (const run of this.runs) {
      byMode[run.mode]   = (byMode[run.mode]   ?? 0) + 1;
      byGrade[run.grade] = (byGrade[run.grade] ?? 0) + 1;
      playerSet.add(run.playerId);
      for (const p of run.principlesLearned) {
        principleCount[p] = (principleCount[p] ?? 0) + 1;
      }
    }

    const topPrinciples = Object.entries(principleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p]) => p);

    return {
      totalRuns:    this.runs.length,
      byMode:       byMode as Record<GameMode, number>,
      byGrade,
      topPrinciples,
      uniquePlayers: playerSet.size,
    };
  }

  // ── Serialization ─────────────────────────────────────────────────────────────

  /** Serialize the entire index to JSON for persistence */
  serialize(): string {
    return JSON.stringify(this.runs);
  }

  /** Reload from serialized JSON. Re-validates all entry hashes. */
  static deserialize(json: string): VerifiedRunIndex {
    const index = new VerifiedRunIndex();
    const raw   = JSON.parse(json) as VerifiedRunRecord[];
    const result = index.addBatch(raw);
    if (result.rejected > 0) {
      console.warn(
        `[VerifiedRunIndex] ${result.rejected} runs rejected on deserialization:`,
        result.errors,
      );
    }
    return index;
  }
}