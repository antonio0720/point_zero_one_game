// /pzo_server/src/liveops/mechanics/m132.ts
// M132 — Case Files: Run Post-Mortems as Narrative Dossiers
// ML/DL Companion: Forensic Summarizer + Root-Cause Ranker (M132a)
// tslint:disable:no-any

import { createHash } from 'crypto';
// Minimal local IMLModel interface to avoid external dependency resolution errors.
// Matches the methods used by this file's ML model implementation.
export interface IMLModel {
  getBoundedOutput(): [number, number] | null;
  scoreEvents(events: RunLedgerEvent[], seed: string): number[];
  getAuditHash(): string;
  getModelCardStamp(featureSchemaHash: string): ModelCardStamp;
}
export interface IMonetizationMechanic {
  getMLModel(): IMLModel | null;
  isDeterministic(): boolean;
  getBoundedOutput(): [number, number] | null;
  getAuditHash(): string;
  generateDossier(snapshot: WipeSnapshot, caseLibrary?: string[], redacted?: boolean): CaseDossier;
}

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface RunLedgerEvent {
  tick: number;
  eventType: string;                  // e.g. 'REFI_ATTEMPT', 'CARD_DRAWN', 'CONDITION_FAIL'
  description: string;
  cashDelta?: number;
  incomeGainDelta?: number;
  liabilityDelta?: number;
  receiptHash: string;
}

export interface WipeSnapshot {
  runId: string;
  playerId: string;
  seed: string;
  rulesetHash: string;
  terminatedAtTick: number;
  terminationReason: 'wipe' | 'close_call' | 'timeout' | 'fubar';
  finalCash: number;
  finalPassiveIncome: number;
  finalMonthlyExpenses: number;
  events: RunLedgerEvent[];
}

export interface CausalFinding {
  rank: number;                       // 1 = highest leverage
  tick: number;
  eventType: string;
  description: string;
  pivotSuggestion: string;            // what could have been done differently
  confidenceScore: number;            // [0..1]
  receiptHash: string;
}

export interface CaseDossier {
  caseId: string;
  runId: string;
  playerId: string;
  generatedAt: string;
  timeline: RunLedgerEvent[];         // ordered events
  topCauses: CausalFinding[];         // ranked root causes (max 2)
  narrativeSummary: string;           // plain-language forensic summary
  similarCaseLinks: string[];         // caseIds of similar past runs
  redacted: boolean;
  exportable: boolean;
  auditHash: string;
  modelCardStamp: ModelCardStamp | null;
}

export interface ModelCardStamp {
  modelId: string;
  trainCut: string;
  featureSchemaHash: string;
}

// ─── ML Model ─────────────────────────────────────────────────────────────────

export class M132CaseFilesMLModel implements IMLModel {
  private readonly mlEnabled: boolean;
  private readonly MODEL_ID = 'M132a_forensic_summarizer_v1';

  constructor(mlEnabled: boolean) {
    this.mlEnabled = mlEnabled;
  }

  /**
   * Returns bounded confidence scores [0..1] for each ledger event
   * indicating its causal contribution to the wipe.
   * Uses a rule-based causal inference approach seeded by the run hash.
   */
  public getBoundedOutput(): [number, number] | null {
    if (!this.mlEnabled) return null;
    // Bounded output range for root-cause confidence scores
    return [0.0, 1.0];
  }

  /**
   * Scores each event for causal contribution [0..1].
   * High-leverage events: condition failures, forced liquidations, missed refi windows.
   */
  public scoreEvents(events: RunLedgerEvent[], seed: string): number[] {
    const HIGH_LEVERAGE = new Set([
      'CONDITION_FAIL', 'FORCED_LIQUIDATION', 'LOAN_DENIED',
      'REFI_MISSED', 'TURN_LOCKED', 'FUBAR_TRIGGER',
    ]);
    const MEDIUM_LEVERAGE = new Set([
      'REFI_ATTEMPT', 'MARKET_EVENT', 'DOODAD_PENALTY',
    ]);

    return events.map((e, i) => {
      let base = HIGH_LEVERAGE.has(e.eventType)
        ? 0.7
        : MEDIUM_LEVERAGE.has(e.eventType)
        ? 0.4
        : 0.1;

      // Recency bias: events near termination carry more causal weight
      const recencyBoost = i / Math.max(events.length - 1, 1) * 0.3;

      // Seed-derived micro-variation for determinism
      const seedByte = createHash('sha256').update(seed + e.receiptHash).digest()[0];
      const seedNoise = (seedByte / 255) * 0.05;

      return Math.min(base + recencyBoost + seedNoise, 1);
    });
  }

  public getAuditHash(): string {
    return this.MODEL_ID;
  }

  public getModelCardStamp(featureSchemaHash: string): ModelCardStamp {
    return {
      modelId: this.MODEL_ID,
      trainCut: '2026-01',
      featureSchemaHash,
    };
  }
}

// ─── Case File Generator ──────────────────────────────────────────────────────

export class M132CaseFilesRunPostMortemsAsNarrativeDossiers implements IMonetizationMechanic {
  private readonly mlEnabled: boolean;
  private readonly auditHashValue: string;
  private readonly mlModel: M132CaseFilesMLModel;

  constructor(mlEnabled: boolean, auditHash: string) {
    this.mlEnabled = mlEnabled;
    this.auditHashValue = auditHash;
    this.mlModel = new M132CaseFilesMLModel(mlEnabled);
  }

  // ── IMonetizationMechanic interface ──────────────────────────────────────

  public getMLModel(): IMLModel | null {
    return this.mlEnabled ? this.mlModel : null;
  }

  public isDeterministic(): boolean {
    return true; // same snapshot → same dossier (receipts-anchored)
  }

  public getBoundedOutput(): [number, number] | null {
    if (!this.mlEnabled) return null;
    return this.mlModel.getBoundedOutput();
  }

  public getAuditHash(): string {
    return this.auditHashValue;
  }

  // ── Core: Generate Dossier ────────────────────────────────────────────────

  /**
   * Builds a full narrative case dossier from a wipe snapshot.
   * If ML is enabled: ranks root causes with confidence scores.
   * If ML disabled: uses rule-based event-type prioritization.
   */
  public generateDossier(
    snapshot: WipeSnapshot,
    caseLibrary: string[] = [],
    redacted: boolean = false,
  ): CaseDossier {
    const timeline = [...snapshot.events].sort((a, b) => a.tick - b.tick);

    const topCauses = this._identifyRootCauses(snapshot, timeline);
    const narrativeSummary = this._buildNarrative(snapshot, topCauses);
    const similarCaseLinks = this._findSimilarCases(snapshot, caseLibrary);
    const featureSchemaHash = createHash('sha256')
      .update(snapshot.rulesetHash + snapshot.seed)
      .digest('hex')
      .slice(0, 16);

    const caseId = createHash('sha256')
      .update(`${snapshot.runId}:${snapshot.playerId}:${snapshot.terminatedAtTick}`)
      .digest('hex')
      .slice(0, 16);

    const auditHash = createHash('sha256')
      .update(
        JSON.stringify({
          caseId,
          runId: snapshot.runId,
          seed: snapshot.seed,
          rulesetHash: snapshot.rulesetHash,
          eventCount: timeline.length,
        }),
      )
      .digest('hex');

    return {
      caseId,
      runId: snapshot.runId,
      playerId: snapshot.playerId,
      generatedAt: new Date().toISOString(),
      timeline: redacted ? this._redactTimeline(timeline) : timeline,
      topCauses,
      narrativeSummary,
      similarCaseLinks,
      redacted,
      exportable: true,
      auditHash,
      modelCardStamp: this.mlEnabled
        ? this.mlModel.getModelCardStamp(featureSchemaHash)
        : null,
    };
  }

  // ── Private: Root Cause Analysis ─────────────────────────────────────────

  private _identifyRootCauses(
    snapshot: WipeSnapshot,
    timeline: RunLedgerEvent[],
  ): CausalFinding[] {
    const scores = this.mlEnabled
      ? this.mlModel.scoreEvents(timeline, snapshot.seed)
      : this._ruleBasedScores(timeline);

    // Rank top 2 only per M132a spec
    const ranked = timeline
      .map((e, i) => ({ event: e, score: scores[i] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    return ranked.map((item, idx) => ({
      rank: idx + 1,
      tick: item.event.tick,
      eventType: item.event.eventType,
      description: item.event.description,
      pivotSuggestion: this._derivePivot(item.event),
      confidenceScore: Math.min(Math.max(item.score, 0), 1),
      receiptHash: item.event.receiptHash,
    }));
  }

  private _ruleBasedScores(timeline: RunLedgerEvent[]): number[] {
    const HIGH = new Set(['CONDITION_FAIL', 'FORCED_LIQUIDATION', 'LOAN_DENIED', 'FUBAR_TRIGGER']);
    const MED = new Set(['REFI_ATTEMPT', 'MARKET_EVENT', 'DOODAD_PENALTY', 'TURN_LOCKED']);
    return timeline.map((e, i) => {
      const base = HIGH.has(e.eventType) ? 0.75 : MED.has(e.eventType) ? 0.45 : 0.1;
      return base + (i / Math.max(timeline.length - 1, 1)) * 0.25;
    });
  }

  private _derivePivot(event: RunLedgerEvent): string {
    const pivotMap: Record<string, string> = {
      CONDITION_FAIL:
        `At tick ${event.tick}: clearing conditions earlier would have prevented cascading liability.`,
      FORCED_LIQUIDATION:
        `At tick ${event.tick}: maintaining a larger cash buffer would have avoided forced liquidation.`,
      LOAN_DENIED:
        `At tick ${event.tick}: reducing liabilities before applying would have improved loan eligibility.`,
      REFI_MISSED:
        `At tick ${event.tick}: acting within the refi window (earlier in the turn cycle) would have secured better terms.`,
      FUBAR_TRIGGER:
        `At tick ${event.tick}: hedging with a shield or reserve would have absorbed the FUBAR impact.`,
      TURN_LOCKED:
        `At tick ${event.tick}: avoiding the triggering condition would have preserved turn access.`,
    };
    return (
      pivotMap[event.eventType] ??
      `At tick ${event.tick}: review this action for alternative decision paths.`
    );
  }

  // ── Private: Narrative Builder ────────────────────────────────────────────

  private _buildNarrative(snapshot: WipeSnapshot, topCauses: CausalFinding[]): string {
    const termMap: Record<string, string> = {
      wipe: 'a full wipe',
      close_call: 'a close-call event',
      timeout: 'a timeout termination',
      fubar: 'a FUBAR cascade',
    };
    const termLabel = termMap[snapshot.terminationReason] ?? 'termination';

    const causeLines = topCauses
      .map(c => `  [${c.rank}] Tick ${c.tick} — ${c.eventType}: ${c.description} (confidence: ${(c.confidenceScore * 100).toFixed(0)}%)`)
      .join('\n');

    return [
      `RUN FORENSIC DOSSIER — ${snapshot.runId}`,
      `Terminated at tick ${snapshot.terminatedAtTick} via ${termLabel}.`,
      `Final state: cash $${snapshot.finalCash.toFixed(2)}, passive income $${snapshot.finalPassiveIncome.toFixed(2)}/mo, expenses $${snapshot.finalMonthlyExpenses.toFixed(2)}/mo.`,
      ``,
      `TOP CAUSAL FACTORS:`,
      causeLines || '  No high-leverage events identified.',
      ``,
      `All claims are anchored to receipts in the run ledger.`,
    ].join('\n');
  }

  private _findSimilarCases(snapshot: WipeSnapshot, caseLibrary: string[]): string[] {
    // Similarity: same rulesetHash prefix + same terminationReason
    return caseLibrary
      .filter(caseId =>
        caseId.includes(snapshot.rulesetHash.slice(0, 4)) ||
        caseId.includes(snapshot.terminationReason),
      )
      .slice(0, 3);
  }

  private _redactTimeline(timeline: RunLedgerEvent[]): RunLedgerEvent[] {
    return timeline.map(e => ({
      ...e,
      description: '[REDACTED]',
      cashDelta: undefined,
      incomeGainDelta: undefined,
      liabilityDelta: undefined,
    }));
  }
}
