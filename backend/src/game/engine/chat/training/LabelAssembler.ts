/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TRAINING LABEL ASSEMBLER
 * FILE: backend/src/game/engine/chat/training/LabelAssembler.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Converts authoritative chat dataset windows into deterministic supervised
 * labels backed by transcript truth, replay truth, proof edges, telemetry
 * truth, and inference-replay continuity.
 *
 * This file exists because DatasetBuilder assembles reproducible examples while
 * label logic is its own discipline. The labeler must answer:
 *
 * - what happened after the anchor,
 * - whether an intervention worked,
 * - whether a helper was ignored or respected,
 * - whether a hater escalation landed,
 * - whether churn was prevented or accelerated,
 * - whether moderation hit for the right reason,
 * - which channel actually fit the moment,
 * - which dialogue turn deserves positive rank credit,
 * - which sequences are memory-worthy.
 *
 * Label doctrine encoded here
 * --------------------------
 * 1. Labels must be traceable to evidence refs.
 * 2. Labels must prefer authoritative outcomes over heuristics when both exist.
 * 3. Confidence must degrade when evidence is thin or conflicting.
 * 4. Multiple weak signals may support one label, but the rationale must be
 *    explicit.
 * 5. Churn / recovery / moderation / intervention labels must not depend on
 *    raw client guesses.
 */

import type {
  JsonValue,
  TrainingCorpus,
  TrainingTaskKey,
  TrainingExample,
  TrainingWindow,
  TrainingEvidenceRef,
  TrainingTranscriptEntry,
  TrainingTelemetryRecord,
  TrainingInferenceSnapshot,
  TrainingReplayArtifact,
  TrainingProofEdge,
  TrainingSplit,
  TrainingExampleFeatures,
} from './DatasetBuilder';

// ============================================================================
// MARK: Label contracts
// ============================================================================

export type LabelValue = string | number | boolean | null;

export interface LabelEvidence {
  readonly ref: TrainingEvidenceRef;
  readonly note: string;
  readonly weight: number;
}

export interface LabelDecision {
  readonly task: TrainingTaskKey;
  readonly primaryLabel: string;
  readonly secondaryLabels: readonly string[];
  readonly scalarTargets: Readonly<Record<string, number>>;
  readonly booleanTargets: Readonly<Record<string, boolean>>;
  readonly categoricalTargets: Readonly<Record<string, string | null>>;
  readonly confidence01: number;
  readonly conflictingEvidence: boolean;
  readonly evidence: readonly LabelEvidence[];
  readonly rationale: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface LabeledTrainingExample extends TrainingExample {
  readonly labels: LabelDecision;
}

export interface LabeledTaskDataset {
  readonly task: TrainingTaskKey;
  readonly examples: readonly LabeledTrainingExample[];
  readonly bySplit: Readonly<Record<TrainingSplit, readonly LabeledTrainingExample[]>>;
  readonly stats: LabeledTaskDatasetStats;
}

export interface LabeledTaskDatasetStats {
  readonly totalExamples: number;
  readonly averageConfidence01: number;
  readonly labelHistogram: Readonly<Record<string, number>>;
  readonly conflictingEvidenceCount: number;
  readonly weakEvidenceCount: number;
}

export interface LabeledTrainingCorpus {
  readonly manifest: LabelManifest;
  readonly tasks: Readonly<Record<TrainingTaskKey, LabeledTaskDataset>>;
}

export interface LabelManifest {
  readonly version: string;
  readonly labeledAt: number;
  readonly labelerSignature: string;
  readonly taskCount: number;
  readonly sourceCorpusVersion: string;
  readonly options: NormalizedLabelAssemblyOptions;
}

export interface LabelAssemblyOptions {
  readonly minimumEvidenceWeight?: number;
  readonly minimumConfidence01?: number;
  readonly allowHeuristicBackfill?: boolean;
  readonly helperSuccessWindowMs?: number;
  readonly churnWindowMs?: number;
  readonly responseRankWindowMs?: number;
  readonly memoryAnchorThreshold01?: number;
}

export interface NormalizedLabelAssemblyOptions {
  readonly minimumEvidenceWeight: number;
  readonly minimumConfidence01: number;
  readonly allowHeuristicBackfill: boolean;
  readonly helperSuccessWindowMs: number;
  readonly churnWindowMs: number;
  readonly responseRankWindowMs: number;
  readonly memoryAnchorThreshold01: number;
}

const LABEL_ASSEMBLER_VERSION = '2026.03.14' as const;

const DEFAULT_OPTIONS: NormalizedLabelAssemblyOptions = Object.freeze({
  minimumEvidenceWeight: 0.5,
  minimumConfidence01: 0.2,
  allowHeuristicBackfill: true,
  helperSuccessWindowMs: 45_000,
  churnWindowMs: 120_000,
  responseRankWindowMs: 25_000,
  memoryAnchorThreshold01: 0.62,
});

const RECOVERY_WORDS = Object.freeze(['recover', 'recovery', 'steady', 'breathe', 'stabilize', 'reset', 'you\'re fine']);
const ESCALATION_WORDS = Object.freeze(['liquidation', 'swarm', 'attack', 'compliance', 'finished', 'done']);
const GRATITUDE_WORDS = Object.freeze(['thanks', 'thank you', 'got it', 'helped', 'that worked']);
const IGNORE_PATTERNS = Object.freeze(['leave me alone', 'stop', 'no', 'ignore', 'shut up']);
const TOXIC_WORDS = Object.freeze(['idiot', 'garbage', 'worthless', 'trash', 'hate']);

// ============================================================================
// MARK: Label assembler
// ============================================================================

export class LabelAssembler {
  private readonly options: NormalizedLabelAssemblyOptions;

  public constructor(options: LabelAssemblyOptions = {}) {
    this.options = Object.freeze({ ...DEFAULT_OPTIONS, ...options });
  }

  public assembleCorpus(corpus: TrainingCorpus): LabeledTrainingCorpus {
    const tasks = {} as Record<TrainingTaskKey, LabeledTaskDataset>;

    for (const task of Object.keys(corpus.tasks) as TrainingTaskKey[]) {
      const dataset = corpus.tasks[task];
      const examples = dataset.examples.map((example) => this.assembleExample(example));
      const bySplit = Object.freeze({
        TRAIN: Object.freeze(examples.filter((example) => example.split === 'TRAIN')),
        VALIDATION: Object.freeze(examples.filter((example) => example.split === 'VALIDATION')),
        TEST: Object.freeze(examples.filter((example) => example.split === 'TEST')),
      });

      tasks[task] = Object.freeze({
        task,
        examples: Object.freeze(examples),
        bySplit,
        stats: this.buildStats(examples),
      });
    }

    return Object.freeze({
      manifest: Object.freeze({
        version: LABEL_ASSEMBLER_VERSION,
        labeledAt: Date.now(),
        labelerSignature: 'backend/src/game/engine/chat/training/LabelAssembler.ts',
        taskCount: Object.keys(tasks).length,
        sourceCorpusVersion: corpus.manifest.version,
        options: this.options,
      }),
      tasks: Object.freeze(tasks),
    });
  }

  public assembleExample(example: TrainingExample): LabeledTrainingExample {
    const labels = this.dispatch(example.task, example);
    return Object.freeze({
      ...example,
      labels,
    });
  }

  public exportTaskNdjson(corpus: LabeledTrainingCorpus, task: TrainingTaskKey): string {
    return corpus.tasks[task].examples.map((example) => JSON.stringify(example)).join('\n');
  }

  private dispatch(task: TrainingTaskKey, example: TrainingExample): LabelDecision {
    switch (task) {
      case 'ENGAGEMENT':
        return this.labelEngagement(example);
      case 'HATER_TARGETING':
        return this.labelHaterTargeting(example);
      case 'HELPER_TIMING':
        return this.labelHelperTiming(example);
      case 'CHANNEL_AFFINITY':
        return this.labelChannelAffinity(example);
      case 'TOXICITY_RISK':
        return this.labelToxicity(example);
      case 'CHURN_RISK':
        return this.labelChurn(example);
      case 'INTERVENTION_POLICY':
        return this.labelIntervention(example);
      case 'RESPONSE_RANKING':
        return this.labelResponseRanking(example);
      case 'SEQUENCE_MEMORY':
        return this.labelSequenceMemory(example);
      case 'MODERATION_OUTCOME':
        return this.labelModeration(example);
      default:
        return this.makeDecision(task, 'UNKNOWN', [], {}, {}, {}, [], ['Unhandled task'], false, {});
    }
  }

  // ========================================================================
  // MARK: Task-specific labelers
  // ========================================================================

  private labelEngagement(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const playerReplies = postPlayerReplies(example.window);
    const responseDelay = firstPlayerReplyDelay(example.window);
    const rageSignals = findTelemetry(example.window, (record) => record.type.includes('rage') || record.type.includes('drop'));
    const helperFollowThrough = findTelemetry(example.window, (record) => record.type.includes('recovery') || record.type.includes('helper_fire'));

    let primaryLabel = 'LOW_ENGAGEMENT';
    let engagementScore = 0.15;

    if (playerReplies.length >= 2) {
      primaryLabel = 'HIGH_ENGAGEMENT';
      engagementScore = 0.85;
      rationale.push('Multiple player replies occurred after the anchor.');
      evidence.push(...evidenceFromMessages(playerReplies.slice(0, 3), 'reply_after_anchor', 0.35));
    } else if (playerReplies.length === 1) {
      primaryLabel = 'MEDIUM_ENGAGEMENT';
      engagementScore = 0.58;
      rationale.push('A single player reply occurred after the anchor.');
      evidence.push(...evidenceFromMessages(playerReplies.slice(0, 1), 'single_reply_after_anchor', 0.22));
    }

    if (responseDelay !== null && responseDelay <= 12_000) {
      engagementScore += 0.12;
      rationale.push('The player replied quickly after the anchor.');
    }

    if (helperFollowThrough.length > 0) {
      engagementScore += 0.08;
      rationale.push('Recovery/helper telemetry indicates the conversation remained active.');
      evidence.push(...evidenceFromTelemetry(helperFollowThrough.slice(0, 2), 'recovery_telemetry', 0.18));
    }

    if (rageSignals.length > 0 && playerReplies.length === 0) {
      primaryLabel = 'DISENGAGED_AFTER_ANCHOR';
      engagementScore = 0.07;
      rationale.push('Rage/drop telemetry fired without a player reply.');
      evidence.push(...evidenceFromTelemetry(rageSignals.slice(0, 2), 'rage_without_reply', 0.42));
    }

    const confidence = boundedConfidence(scoreEvidenceWeight(evidence), engagementScore);
    return this.makeDecision(
      'ENGAGEMENT',
      primaryLabel,
      engagementSecondary(primaryLabel, responseDelay, rageSignals.length),
      { engagement_score_01: clamp01(engagementScore), response_delay_ms: responseDelay ?? -1 },
      { replied_after_anchor: playerReplies.length > 0, rage_signal_present: rageSignals.length > 0 },
      { response_delay_band: responseDelayBand(responseDelay) },
      evidence,
      rationale,
      conflictingReplyVsRage(playerReplies.length, rageSignals.length),
      { reply_count: playerReplies.length },
    );
  }

  private labelHaterTargeting(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const haterReplies = postMessagesBySource(example.window, 'HATER');
    const attackSignals = findTelemetry(example.window, (record) => record.type.includes('attack') || record.type.includes('hater'));
    const helperReplies = postMessagesBySource(example.window, 'HELPER');

    let primaryLabel = 'SUPPRESS_HATER';
    let fireScore = 0.18;

    if (haterReplies.length > 0 || attackSignals.length > 0) {
      primaryLabel = 'FIRE_HATER';
      fireScore = 0.84;
      rationale.push('Authoritative post-anchor evidence shows hater follow-through.');
      evidence.push(...evidenceFromMessages(haterReplies.slice(0, 2), 'hater_followthrough', 0.36));
      evidence.push(...evidenceFromTelemetry(attackSignals.slice(0, 2), 'attack_signal', 0.28));
    }

    if (helperReplies.length > 0 && haterReplies.length === 0) {
      primaryLabel = 'DEFER_TO_HELPER';
      fireScore = 0.32;
      rationale.push('Helper activity displaced hater escalation after the anchor.');
      evidence.push(...evidenceFromMessages(helperReplies.slice(0, 2), 'helper_displacement', 0.24));
    }

    const confidence = boundedConfidence(scoreEvidenceWeight(evidence), fireScore);
    return this.makeDecision(
      'HATER_TARGETING',
      primaryLabel,
      haterSecondary(haterReplies.length, helperReplies.length),
      { hater_fire_score_01: clamp01(fireScore), hater_reply_count: haterReplies.length },
      { hater_replied: haterReplies.length > 0, helper_displaced: helperReplies.length > 0 && haterReplies.length === 0 },
      { escalation_band: band01(fireScore) },
      evidence,
      rationale,
      helperReplies.length > 0 && haterReplies.length > 0,
      { attack_signal_count: attackSignals.length },
    );
  }

  private labelHelperTiming(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const helperReplies = postMessagesBySource(example.window, 'HELPER');
    const gratitudeReplies = helperAcceptanceReplies(example.window);
    const ignoreReplies = helperIgnoreReplies(example.window);
    const rescueTelemetry = findTelemetry(example.window, (record) => record.type.includes('helper') || record.type.includes('recovery'));

    let primaryLabel = 'WAIT';
    let timingScore = 0.35;

    if (helperReplies.length > 0 || rescueTelemetry.length > 0) {
      primaryLabel = 'INTERVENE_NOW';
      timingScore = 0.78;
      rationale.push('Helper/recovery evidence fired inside the post-anchor window.');
      evidence.push(...evidenceFromMessages(helperReplies.slice(0, 2), 'helper_followthrough', 0.34));
      evidence.push(...evidenceFromTelemetry(rescueTelemetry.slice(0, 2), 'helper_recovery_telemetry', 0.28));
    }

    if (gratitudeReplies.length > 0) {
      timingScore += 0.12;
      rationale.push('Player acceptance/gratitude followed helper intervention.');
      evidence.push(...evidenceFromMessages(gratitudeReplies.slice(0, 2), 'helper_acceptance', 0.22));
    }

    if (ignoreReplies.length > 0) {
      primaryLabel = helperReplies.length > 0 ? 'INTERVENE_SOFT' : 'WAIT';
      timingScore = Math.min(timingScore, 0.49);
      rationale.push('Player language suggests resistance or helper rejection.');
      evidence.push(...evidenceFromMessages(ignoreReplies.slice(0, 2), 'helper_ignore', 0.24));
    }

    return this.makeDecision(
      'HELPER_TIMING',
      primaryLabel,
      helperSecondary(gratitudeReplies.length, ignoreReplies.length),
      { helper_timing_score_01: clamp01(timingScore) },
      { helper_fired: helperReplies.length > 0, helper_accepted: gratitudeReplies.length > 0, helper_ignored: ignoreReplies.length > 0 },
      { helper_response_mode: ignoreReplies.length > 0 ? 'RESISTED' : gratitudeReplies.length > 0 ? 'ACCEPTED' : 'NEUTRAL' },
      evidence,
      rationale,
      gratitudeReplies.length > 0 && ignoreReplies.length > 0,
      { helper_reply_count: helperReplies.length },
    );
  }

  private labelChannelAffinity(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const dominantChannel = String(example.features.categorical.dominant_channel ?? 'UNKNOWN');
    const playerAskedForHelp = Boolean(example.features.boolean.player_asked_for_help);
    const toxic = Boolean(example.features.boolean.anchor_contains_toxicity || Number(example.features.scalar.toxic_lexicon_hits) > 0);
    const overpayRisk = Number(example.features.scalar.overpay_risk_01 ?? 0);

    let label = dominantChannel;
    if (overpayRisk > 0.55) {
      label = 'DEAL_ROOM';
      rationale.push('Deal/economy pressure suggests the negotiation lane is a better fit.');
    } else if (playerAskedForHelp) {
      label = 'SYNDICATE';
      rationale.push('Help-seeking language suggests a more intimate/advisory channel.');
    } else if (toxic) {
      label = 'SHADOW';
      rationale.push('Toxic/moderation-sensitive language suggests shadow containment.');
    } else if (!label || label === 'UNKNOWN') {
      label = 'GLOBAL';
      rationale.push('No stronger authority signal exists, so the stage/global lane remains the fallback.');
    }

    const anchorMessages = example.window.anchorMessages;
    evidence.push(...evidenceFromMessages(anchorMessages.slice(0, 2), 'channel_anchor', 0.2));

    return this.makeDecision(
      'CHANNEL_AFFINITY',
      label,
      channelSecondary(example.features),
      { channel_affinity_score_01: channelConfidenceScore(label, example.features) },
      { toxic, player_asked_for_help: playerAskedForHelp },
      { dominant_channel: dominantChannel },
      evidence,
      rationale,
      false,
      { overpay_risk_01: overpayRisk },
    );
  }

  private labelToxicity(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const moderation = example.window.anchorMessages.some((entry) => entry.message.policy.moderationOutcome !== 'ALLOWED');
    const masked = example.window.anchorMessages.some((entry) => entry.message.policy.wasMasked);
    const rewritten = example.window.anchorMessages.some((entry) => entry.message.policy.wasRewritten);
    const toxicHits = Number(example.features.scalar.toxic_lexicon_hits ?? 0);

    let primaryLabel = 'LOW_RISK';
    let riskScore = 0.08;

    if (moderation || toxicHits >= 2) {
      primaryLabel = 'HIGH_RISK';
      riskScore = 0.82;
      rationale.push('Moderation or explicit toxicity evidence exists on the authoritative anchor.');
      evidence.push(...evidenceFromMessages(example.window.anchorMessages.slice(0, 2), 'moderated_anchor', 0.36));
    } else if (toxicHits === 1) {
      primaryLabel = 'MEDIUM_RISK';
      riskScore = 0.51;
      rationale.push('A single toxicity indicator appears without a hard moderation hit.');
      evidence.push(...evidenceFromMessages(example.window.anchorMessages.slice(0, 1), 'toxicity_lexicon', 0.18));
    }

    if (masked || rewritten) {
      riskScore += 0.08;
      rationale.push('Mask/rewrite behavior increases moderation sensitivity.');
    }

    return this.makeDecision(
      'TOXICITY_RISK',
      primaryLabel,
      toxicitySecondary(masked, rewritten),
      { toxicity_risk_score_01: clamp01(riskScore) },
      { moderation_hit: moderation, masked, rewritten },
      { moderation_outcome: anchorModerationOutcome(example.window) },
      evidence,
      rationale,
      masked && rewritten,
      { toxic_lexicon_hits: toxicHits },
    );
  }

  private labelChurn(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const rageSignals = findTelemetry(example.window, (record) => record.type.includes('rage') || record.type.includes('drop') || record.type.includes('close'));
    const playerReplies = postPlayerReplies(example.window);
    const silenceAfter = firstPlayerReplyDelay(example.window);
    const recoverySignals = findTelemetry(example.window, (record) => record.type.includes('recovery') || record.type.includes('helper_fire'));

    let primaryLabel = 'LOW_CHURN_RISK';
    let riskScore = 0.12;

    if (rageSignals.length > 0 && playerReplies.length === 0) {
      primaryLabel = 'HIGH_CHURN_RISK';
      riskScore = 0.88;
      rationale.push('Rage/drop telemetry fired and the player did not re-engage.');
      evidence.push(...evidenceFromTelemetry(rageSignals.slice(0, 3), 'rage_or_drop', 0.42));
    } else if (silenceAfter !== null && silenceAfter > 45_000) {
      primaryLabel = 'MEDIUM_CHURN_RISK';
      riskScore = 0.57;
      rationale.push('The player remained silent for a long period after the anchor.');
    }

    if (recoverySignals.length > 0 || playerReplies.length > 0) {
      riskScore -= 0.18;
      rationale.push('Recovery/reply evidence reduces churn likelihood.');
      evidence.push(...evidenceFromTelemetry(recoverySignals.slice(0, 2), 'recovery_followup', 0.16));
    }

    return this.makeDecision(
      'CHURN_RISK',
      primaryLabel,
      churnSecondary(playerReplies.length, recoverySignals.length),
      { churn_risk_score_01: clamp01(riskScore), silence_after_ms: silenceAfter ?? -1 },
      { rage_signal_present: rageSignals.length > 0, recovered_after_anchor: recoverySignals.length > 0 || playerReplies.length > 0 },
      { churn_band: band01(riskScore) },
      evidence,
      rationale,
      rageSignals.length > 0 && playerReplies.length > 0,
      { post_player_reply_count: playerReplies.length },
    );
  }

  private labelIntervention(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const helperReplies = postMessagesBySource(example.window, 'HELPER');
    const haterReplies = postMessagesBySource(example.window, 'HATER');
    const gratitude = helperAcceptanceReplies(example.window);
    const ignore = helperIgnoreReplies(example.window);
    const recoverySignals = findTelemetry(example.window, (record) => record.type.includes('recovery') || record.type.includes('helper'));

    let primaryLabel = 'SUPPRESS';
    let policyScore = 0.18;

    if (helperReplies.length > 0 || recoverySignals.length > 0) {
      primaryLabel = gratitude.length > 0 ? 'HELPER_RESCUE' : 'HELPER_STABILIZE';
      policyScore = gratitude.length > 0 ? 0.83 : 0.64;
      rationale.push('Helper-side intervention evidence exists in the authoritative aftermath.');
      evidence.push(...evidenceFromMessages(helperReplies.slice(0, 2), 'helper_intervention', 0.34));
      evidence.push(...evidenceFromTelemetry(recoverySignals.slice(0, 2), 'helper_recovery', 0.2));
    }

    if (haterReplies.length > 0 && helperReplies.length === 0) {
      primaryLabel = 'ALLOW_PRESSURE';
      policyScore = 0.61;
      rationale.push('Hater escalation proceeded without helper displacement.');
      evidence.push(...evidenceFromMessages(haterReplies.slice(0, 2), 'hater_pressure', 0.24));
    }

    if (ignore.length > 0) {
      primaryLabel = 'SOFTEN_HELPER';
      policyScore = Math.min(policyScore, 0.46);
      rationale.push('Player rejection language suggests helper tone or cadence should soften.');
      evidence.push(...evidenceFromMessages(ignore.slice(0, 2), 'helper_resistance', 0.2));
    }

    return this.makeDecision(
      'INTERVENTION_POLICY',
      primaryLabel,
      interventionSecondary(helperReplies.length, haterReplies.length, ignore.length),
      { intervention_policy_score_01: clamp01(policyScore) },
      { helper_intervened: helperReplies.length > 0, hater_escalated: haterReplies.length > 0, helper_resisted: ignore.length > 0 },
      { intervention_mode: primaryLabel },
      evidence,
      rationale,
      helperReplies.length > 0 && haterReplies.length > 0,
      { gratitude_count: gratitude.length },
    );
  }

  private labelResponseRanking(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const postMessages = example.window.postMessages.filter((entry) => entry.message.createdAt <= example.window.anchorAt + this.options.responseRankWindowMs);
    const first = postMessages[0] ?? null;

    let label = 'NO_POSITIVE_CONTINUATION';
    let rankScore = 0.14;

    if (first) {
      label = continuationRankLabel(first);
      rankScore = continuationRankScore(first, example.window);
      rationale.push('First visible continuation after the anchor determines rank credit.');
      evidence.push(...evidenceFromMessages([first], 'first_visible_continuation', 0.32));
    }

    return this.makeDecision(
      'RESPONSE_RANKING',
      label,
      responseRankingSecondary(postMessages),
      { response_rank_score_01: clamp01(rankScore) },
      { continuation_present: first !== null },
      { continuation_source: first?.message.attribution.sourceType ?? null },
      evidence,
      rationale,
      false,
      { post_message_count_in_rank_window: postMessages.length },
    );
  }

  private labelSequenceMemory(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const replayCount = example.window.replayArtifacts.length;
    const proofCount = example.window.proofEdges.length;
    const inferenceCount = example.window.inferenceSnapshots.length;
    const quotedCallbacks = example.window.anchorMessages.filter((entry) => entry.message.bodyParts.some((part) => part.type === 'QUOTE'));
    const legendAnchors = example.window.replayArtifacts.filter((artifact) => artifact.label.toLowerCase().includes('legend'));

    let salience = 0.12;
    salience += Math.min(0.22, replayCount * 0.04);
    salience += Math.min(0.18, proofCount * 0.02);
    salience += Math.min(0.12, inferenceCount * 0.02);
    if (quotedCallbacks.length > 0) salience += 0.14;
    if (legendAnchors.length > 0) salience += 0.18;

    const primaryLabel = salience >= this.options.memoryAnchorThreshold01 ? 'PROMOTE_MEMORY_ANCHOR' : 'DO_NOT_PROMOTE';
    if (primaryLabel === 'PROMOTE_MEMORY_ANCHOR') {
      rationale.push('Replay/proof/inference continuity made this anchor memory-worthy.');
      evidence.push(...evidenceFromReplay(example.window.replayArtifacts.slice(0, 2), 'replay_anchor', 0.22));
      evidence.push(...evidenceFromProof(example.window.proofEdges.slice(0, 3), 'proof_continuity', 0.22));
    }
    if (quotedCallbacks.length > 0) {
      rationale.push('Quote/callback material exists on the anchor.');
      evidence.push(...evidenceFromMessages(quotedCallbacks.slice(0, 1), 'callback_material', 0.18));
    }

    return this.makeDecision(
      'SEQUENCE_MEMORY',
      primaryLabel,
      sequenceMemorySecondary(legendAnchors.length, quotedCallbacks.length),
      { memory_salience_score_01: clamp01(salience) },
      { quoted_callback_present: quotedCallbacks.length > 0, legend_anchor_present: legendAnchors.length > 0 },
      { memory_band: band01(salience) },
      evidence,
      rationale,
      false,
      { replay_count: replayCount, proof_count: proofCount, inference_count: inferenceCount },
    );
  }

  private labelModeration(example: TrainingExample): LabelDecision {
    const evidence: LabelEvidence[] = [];
    const rationale: string[] = [];
    const outcome = anchorModerationOutcome(example.window);
    const masked = example.window.anchorMessages.some((entry) => entry.message.policy.wasMasked);
    const rewritten = example.window.anchorMessages.some((entry) => entry.message.policy.wasRewritten);
    const reasons = uniqueStrings(example.window.anchorMessages.flatMap((entry) => entry.message.policy.moderationReasons));

    evidence.push(...evidenceFromMessages(example.window.anchorMessages.slice(0, 2), 'moderated_anchor', 0.34));
    rationale.push('Anchor moderation metadata is authoritative.');

    return this.makeDecision(
      'MODERATION_OUTCOME',
      outcome,
      moderationSecondary(masked, rewritten, reasons),
      { moderation_confidence_01: outcome === 'ALLOWED' ? 0.7 : 0.9 },
      { masked, rewritten, rejected: outcome == 'REJECTED', shadow_only: outcome == 'SHADOW_ONLY' },
      { moderation_outcome: outcome },
      evidence,
      rationale,
      masked && rewritten,
      { moderation_reason_count: reasons.length, moderation_reasons: reasons },
    );
  }

  // ========================================================================
  // MARK: Stats and decision helpers
  // ========================================================================

  private buildStats(examples: readonly LabeledTrainingExample[]): LabeledTaskDatasetStats {
    const histogram = new Map<string, number>();
    for (const example of examples) {
      histogram.set(example.labels.primaryLabel, (histogram.get(example.labels.primaryLabel) ?? 0) + 1);
    }

    return Object.freeze({
      totalExamples: examples.length,
      averageConfidence01: average(examples.map((example) => example.labels.confidence01)),
      labelHistogram: Object.freeze(Object.fromEntries([...histogram.entries()].sort((a, b) => a[0].localeCompare(b[0])))),
      conflictingEvidenceCount: examples.filter((example) => example.labels.conflictingEvidence).length,
      weakEvidenceCount: examples.filter((example) => scoreEvidenceWeight(example.labels.evidence) < this.options.minimumEvidenceWeight).length,
    });
  }

  private makeDecision(
    task: TrainingTaskKey,
    primaryLabel: string,
    secondaryLabels: readonly string[],
    scalarTargets: Readonly<Record<string, number>>,
    booleanTargets: Readonly<Record<string, boolean>>,
    categoricalTargets: Readonly<Record<string, string | null>>,
    evidence: readonly LabelEvidence[],
    rationale: readonly string[],
    conflictingEvidence: boolean,
    metadata: Readonly<Record<string, JsonValue>>,
  ): LabelDecision {
    const evidenceWeight = scoreEvidenceWeight(evidence);
    const confidence = Math.max(
      this.options.minimumConfidence01,
      boundedConfidence(evidenceWeight, average(Object.values(scalarTargets).filter(Number.isFinite) as number[])),
    );

    return Object.freeze({
      task,
      primaryLabel,
      secondaryLabels: Object.freeze([...secondaryLabels]),
      scalarTargets: Object.freeze({ ...scalarTargets }),
      booleanTargets: Object.freeze({ ...booleanTargets }),
      categoricalTargets: Object.freeze({ ...categoricalTargets }),
      confidence01: clamp01(confidence),
      conflictingEvidence,
      evidence: Object.freeze(dedupeEvidence(evidence)),
      rationale: Object.freeze([...rationale]),
      metadata: Object.freeze({
        ...metadata,
        evidenceWeight,
      }),
    });
  }
}

// ============================================================================
// MARK: Evidence builders
// ============================================================================

function evidenceFromMessages(entries: readonly TrainingTranscriptEntry[], note: string, weight: number): LabelEvidence[] {
  return entries.map((entry) => ({
    ref: {
      kind: 'MESSAGE',
      id: entry.message.id,
      at: entry.message.createdAt,
      role: entry.message.attribution.sourceType,
    },
    note,
    weight,
  }));
}

function evidenceFromTelemetry(records: readonly TrainingTelemetryRecord[], note: string, weight: number): LabelEvidence[] {
  return records.map((record) => ({
    ref: {
      kind: 'TELEMETRY',
      id: record.id,
      at: record.emittedAt,
      role: record.type,
    },
    note,
    weight,
  }));
}

function evidenceFromReplay(artifacts: readonly TrainingReplayArtifact[], note: string, weight: number): LabelEvidence[] {
  return artifacts.map((artifact) => ({
    ref: {
      kind: 'REPLAY',
      id: artifact.id,
      at: artifact.createdAt,
      role: artifact.label,
    },
    note,
    weight,
  }));
}

function evidenceFromProof(edges: readonly TrainingProofEdge[], note: string, weight: number): LabelEvidence[] {
  return edges.map((edge) => ({
    ref: {
      kind: 'PROOF',
      id: edge.id,
      at: edge.createdAt,
      role: edge.edgeType,
    },
    note,
    weight,
  }));
}

function dedupeEvidence(evidence: readonly LabelEvidence[]): readonly LabelEvidence[] {
  const byKey = new Map<string, LabelEvidence>();
  for (const item of evidence) {
    const key = `${item.ref.kind}:${item.ref.id}:${item.note}`;
    const current = byKey.get(key);
    if (!current || current.weight < item.weight) {
      byKey.set(key, item);
    }
  }
  return Object.freeze([...byKey.values()].sort((a, b) => compareEvidence(a, b)));
}

function compareEvidence(left: LabelEvidence, right: LabelEvidence): number {
  return compareNumbers((left.ref.at ?? 0), (right.ref.at ?? 0))
    || compareStrings(left.ref.kind, right.ref.kind)
    || compareStrings(left.ref.id, right.ref.id)
    || compareStrings(left.note, right.note);
}

function scoreEvidenceWeight(evidence: readonly LabelEvidence[]): number {
  const total = evidence.reduce((sum, item) => sum + item.weight, 0);
  return clamp01(total / 1.5);
}

// ============================================================================
// MARK: Window query helpers
// ============================================================================

function postPlayerReplies(window: TrainingWindow): readonly TrainingTranscriptEntry[] {
  return postMessagesBySource(window, 'PLAYER');
}

function postMessagesBySource(window: TrainingWindow, source: string): readonly TrainingTranscriptEntry[] {
  return Object.freeze(window.postMessages.filter((entry) => entry.message.attribution.sourceType === source));
}

function helperAcceptanceReplies(window: TrainingWindow): readonly TrainingTranscriptEntry[] {
  return Object.freeze(postPlayerReplies(window).filter((entry) => lexiconHits(entry.message.plainText, GRATITUDE_WORDS) > 0));
}

function helperIgnoreReplies(window: TrainingWindow): readonly TrainingTranscriptEntry[] {
  return Object.freeze(postPlayerReplies(window).filter((entry) => lexiconHits(entry.message.plainText, IGNORE_PATTERNS) > 0));
}

function findTelemetry(window: TrainingWindow, predicate: (record: TrainingTelemetryRecord) => boolean): readonly TrainingTelemetryRecord[] {
  return Object.freeze(window.telemetry.filter(predicate));
}

function firstPlayerReplyDelay(window: TrainingWindow): number | null {
  const firstReply = postPlayerReplies(window)[0];
  return firstReply ? Math.max(0, firstReply.message.createdAt - window.anchorAt) : null;
}

function anchorModerationOutcome(window: TrainingWindow): string {
  return window.anchorMessages[0]?.message.policy.moderationOutcome ?? 'ALLOWED';
}

function continuationRankLabel(entry: TrainingTranscriptEntry): string {
  const source = entry.message.attribution.sourceType;
  if (source === 'HELPER') return 'HELPER_CONTINUATION';
  if (source === 'HATER') return 'HATER_CONTINUATION';
  if (source === 'PLAYER') return 'PLAYER_FOLLOWUP';
  if (source === 'SYSTEM') return 'SYSTEM_CONTINUATION';
  return 'OTHER_CONTINUATION';
}

function continuationRankScore(entry: TrainingTranscriptEntry, window: TrainingWindow): number {
  let score = 0.25;
  const source = entry.message.attribution.sourceType;
  if (source === 'HELPER') score += 0.18;
  if (source === 'PLAYER') score += 0.12;
  if (source === 'HATER') score += 0.16;
  if (entry.message.policy.moderationOutcome !== 'ALLOWED') score -= 0.1;
  if (lexiconHits(entry.message.plainText, GRATITUDE_WORDS) > 0) score += 0.08;
  if (lexiconHits(entry.message.plainText, TOXIC_WORDS) > 0) score -= 0.1;
  if (window.replayArtifacts.length > 0) score += 0.05;
  return clamp01(score);
}

// ============================================================================
// MARK: Secondary label helpers
// ============================================================================

function engagementSecondary(primaryLabel: string, responseDelay: number | null, rageCount: number): readonly string[] {
  const labels: string[] = [];
  if (responseDelay !== null && responseDelay <= 12_000) labels.push('FAST_REPLY');
  if (responseDelay !== null && responseDelay > 45_000) labels.push('SLOW_REPLY');
  if (rageCount > 0) labels.push('RAGE_SIGNAL_PRESENT');
  if (primaryLabel === 'HIGH_ENGAGEMENT') labels.push('KEEP_PRESSURE');
  return Object.freeze(labels);
}

function haterSecondary(haterCount: number, helperCount: number): readonly string[] {
  const labels: string[] = [];
  if (haterCount > 0) labels.push('ESCALATION_CONFIRMED');
  if (helperCount > 0) labels.push('HELPER_COMPETITION');
  return Object.freeze(labels);
}

function helperSecondary(gratitudeCount: number, ignoreCount: number): readonly string[] {
  const labels: string[] = [];
  if (gratitudeCount > 0) labels.push('HELPER_ACCEPTED');
  if (ignoreCount > 0) labels.push('HELPER_RESISTED');
  return Object.freeze(labels);
}

function channelSecondary(features: TrainingExampleFeatures): readonly string[] {
  const labels: string[] = [];
  if (Boolean(features.boolean.player_asked_for_help)) labels.push('ADVISORY_CONTEXT');
  if (Boolean(features.boolean.anchor_contains_toxicity)) labels.push('CONTAINMENT_CONTEXT');
  if (Number(features.scalar.overpay_risk_01 ?? 0) > 0.55) labels.push('NEGOTIATION_CONTEXT');
  return Object.freeze(labels);
}

function toxicitySecondary(masked: boolean, rewritten: boolean): readonly string[] {
  const labels: string[] = [];
  if (masked) labels.push('MASKED');
  if (rewritten) labels.push('REWRITTEN');
  return Object.freeze(labels);
}

function churnSecondary(replyCount: number, recoveryCount: number): readonly string[] {
  const labels: string[] = [];
  if (replyCount > 0) labels.push('PLAYER_RETURNED');
  if (recoveryCount > 0) labels.push('RECOVERY_SIGNAL');
  return Object.freeze(labels);
}

function interventionSecondary(helperCount: number, haterCount: number, ignoreCount: number): readonly string[] {
  const labels: string[] = [];
  if (helperCount > 0) labels.push('HELPER_ACTIVE');
  if (haterCount > 0) labels.push('PRESSURE_ACTIVE');
  if (ignoreCount > 0) labels.push('HELPER_SOFTEN');
  return Object.freeze(labels);
}

function responseRankingSecondary(messages: readonly TrainingTranscriptEntry[]): readonly string[] {
  const labels: string[] = [];
  if (messages.length > 1) labels.push('MULTI_TURN_CONTINUATION');
  if (messages.some((entry) => entry.message.attribution.sourceType === 'PLAYER')) labels.push('PLAYER_REENTERED');
  return Object.freeze(labels);
}

function sequenceMemorySecondary(legendCount: number, callbackCount: number): readonly string[] {
  const labels: string[] = [];
  if (legendCount > 0) labels.push('LEGEND_SIGNAL');
  if (callbackCount > 0) labels.push('CALLBACK_SIGNAL');
  return Object.freeze(labels);
}

function moderationSecondary(masked: boolean, rewritten: boolean, reasons: readonly string[]): readonly string[] {
  const labels = [...reasons];
  if (masked) labels.push('MASKED');
  if (rewritten) labels.push('REWRITTEN');
  return Object.freeze(uniqueStrings(labels));
}

// ============================================================================
// MARK: Confidence / histogram / small utilities
// ============================================================================

function channelConfidenceScore(label: string, features: TrainingExampleFeatures): number {
  let score = 0.42;
  if (label === 'DEAL_ROOM') score += 0.18;
  if (label === 'SYNDICATE') score += 0.12;
  if (label === 'SHADOW') score += 0.14;
  if (Boolean(features.boolean.player_asked_for_help)) score += 0.05;
  if (Boolean(features.boolean.anchor_contains_toxicity)) score += 0.05;
  return clamp01(score);
}

function boundedConfidence(evidenceScore: number, targetScore: number): number {
  const normalizedTarget = clamp01(targetScore);
  return clamp01((evidenceScore * 0.6) + (normalizedTarget * 0.4));
}

function responseDelayBand(responseDelay: number | null): string | null {
  if (responseDelay === null) return null;
  if (responseDelay <= 12_000) return 'FAST';
  if (responseDelay <= 45_000) return 'MID';
  return 'SLOW';
}

function band01(value: number): string {
  if (value >= 0.75) return 'HIGH';
  if (value >= 0.45) return 'MEDIUM';
  return 'LOW';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function lexiconHits(text: string, lexicon: readonly string[]): number {
  const lowered = text.toLowerCase();
  return lexicon.reduce((count, phrase) => count + (lowered.includes(phrase.toLowerCase()) ? 1 : 0), 0);
}

function compareNumbers(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function conflictingReplyVsRage(replyCount: number, rageCount: number): boolean {
  return replyCount > 0 && rageCount > 0;
}

function boolean_to_int(value: boolean): number {
  return value ? 1 : 0;
}

// ============================================================================
// MARK: Inference snapshot label helpers
// ============================================================================

export interface InferenceLabelDecision {
  readonly snapshotId: string;
  readonly inferredAt: number;
  readonly source: string;
  readonly task: string;
  readonly predictedLabel: string | null;
  readonly score01: number;
  readonly acceptedByPolicy: boolean;
  readonly evidenceRefs: readonly TrainingEvidenceRef[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export function buildInferenceLabelDecision(
  snapshot: TrainingInferenceSnapshot,
  window: TrainingWindow,
): InferenceLabelDecision {
  const score01 = clamp01(snapshot.score01 ?? 0);
  const acceptedByPolicy = score01 >= 0.5 && snapshot.label !== null;

  const evidenceRefs: TrainingEvidenceRef[] = [];
  for (const entry of window.anchorMessages.slice(0, 3)) {
    evidenceRefs.push(Object.freeze({
      kind: 'MESSAGE',
      id: entry.message.id,
      at: entry.message.createdAt,
      role: entry.message.attribution.sourceType,
    }));
  }

  return Object.freeze({
    snapshotId: snapshot.id,
    inferredAt: snapshot.inferredAt,
    source: snapshot.source,
    task: String(snapshot.task),
    predictedLabel: snapshot.label,
    score01,
    acceptedByPolicy,
    evidenceRefs: Object.freeze(evidenceRefs),
    metadata: Object.freeze({
      room_id: snapshot.roomId,
      session_id: snapshot.sessionId ?? null,
      message_id: snapshot.messageId ?? null,
      event_id: snapshot.eventId ?? null,
      accepted_int: boolean_to_int(acceptedByPolicy),
    }),
  });
}

export function batchBuildInferenceLabelDecisions(
  snapshots: readonly TrainingInferenceSnapshot[],
  window: TrainingWindow,
): readonly InferenceLabelDecision[] {
  return Object.freeze(snapshots.map((snapshot) => buildInferenceLabelDecision(snapshot, window)));
}

export function inferenceAcceptanceRate01(decisions: readonly InferenceLabelDecision[]): number {
  if (decisions.length === 0) return 0;
  return decisions.filter((d) => d.acceptedByPolicy).length / decisions.length;
}

export function inferenceAverageScore01(decisions: readonly InferenceLabelDecision[]): number {
  return average(decisions.map((d) => d.score01));
}

// ============================================================================
// MARK: Label quality report
// ============================================================================

export interface LabelFrequencyEntry {
  readonly label: string;
  readonly count: number;
  readonly proportion01: number;
}

export interface LabelQualityReport {
  readonly task: TrainingTaskKey;
  readonly totalExamples: number;
  readonly averageConfidence01: number;
  readonly conflictingEvidenceRate01: number;
  readonly weakEvidenceRate01: number;
  readonly labelEntropy01: number;
  readonly coverageRate01: number;
  readonly topLabels: readonly LabelFrequencyEntry[];
  readonly lowConfidenceExamples: readonly string[];
  readonly conflictingExamples: readonly string[];
  readonly qualityScore01: number;
  readonly findings: readonly string[];
  readonly recommendations: readonly string[];
}

export function assessLabelQuality(
  dataset: LabeledTaskDataset,
  options: LabelAssemblyOptions = {},
): LabelQualityReport {
  const opts: NormalizedLabelAssemblyOptions = Object.freeze({ ...DEFAULT_OPTIONS, ...options });
  const examples = dataset.examples;
  const totalExamples = examples.length;

  if (totalExamples === 0) {
    return Object.freeze({
      task: dataset.task,
      totalExamples: 0,
      averageConfidence01: 0,
      conflictingEvidenceRate01: 0,
      weakEvidenceRate01: 0,
      labelEntropy01: 0,
      coverageRate01: 0,
      topLabels: Object.freeze([]),
      lowConfidenceExamples: Object.freeze([]),
      conflictingExamples: Object.freeze([]),
      qualityScore01: 0,
      findings: Object.freeze(['No examples in dataset.']),
      recommendations: Object.freeze(['Collect authoritative examples before assessing quality.']),
    });
  }

  const averageConfidence01 = average(examples.map((ex) => ex.labels.confidence01));
  const conflictingCount = examples.filter((ex) => ex.labels.conflictingEvidence).length;
  const conflictingEvidenceRate01 = conflictingCount / totalExamples;
  const weakCount = examples.filter(
    (ex) => scoreEvidenceWeight(ex.labels.evidence) < opts.minimumEvidenceWeight,
  ).length;
  const weakEvidenceRate01 = weakCount / totalExamples;

  const labelCounts = new Map<string, number>();
  for (const ex of examples) {
    labelCounts.set(ex.labels.primaryLabel, (labelCounts.get(ex.labels.primaryLabel) ?? 0) + 1);
  }
  const topLabels: LabelFrequencyEntry[] = [...labelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => Object.freeze({ label, count, proportion01: count / totalExamples }));

  const labelEntropy01 = shannonEntropy(topLabels.map((entry) => entry.proportion01));
  const coverageRate01 = clamp01(topLabels.length / 10);

  const lowConfidenceExamples = examples
    .filter((ex) => ex.labels.confidence01 < opts.minimumConfidence01 + 0.1)
    .slice(0, 10)
    .map((ex) => ex.id);

  const conflictingExamples = examples
    .filter((ex) => ex.labels.conflictingEvidence)
    .slice(0, 10)
    .map((ex) => ex.id);

  const qualityScore01 = clamp01(
    (averageConfidence01 * 0.35)
    + (labelEntropy01 * 0.2)
    + (coverageRate01 * 0.15)
    + ((1 - conflictingEvidenceRate01) * 0.15)
    + ((1 - weakEvidenceRate01) * 0.15),
  );

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (averageConfidence01 < 0.5) {
    findings.push(`Average label confidence is low at ${averageConfidence01.toFixed(3)}.`);
    recommendations.push('Review post-anchor evidence windows and improve evidence chain depth.');
  }
  if (conflictingEvidenceRate01 > 0.2) {
    findings.push(`${(conflictingEvidenceRate01 * 100).toFixed(1)}% of examples have conflicting evidence.`);
    recommendations.push('Audit anchor selection logic and evidence window boundaries.');
  }
  if (weakEvidenceRate01 > 0.3) {
    findings.push(`${(weakEvidenceRate01 * 100).toFixed(1)}% of examples have weak evidence.`);
    recommendations.push('Increase post-anchor window size or enrich telemetry coverage.');
  }
  if (labelEntropy01 < 0.3) {
    findings.push(`Label distribution is imbalanced (entropy=${labelEntropy01.toFixed(3)}).`);
    recommendations.push('Ensure sampling covers all label classes equally.');
  }
  if (findings.length === 0) {
    findings.push('Label quality is within expected bounds.');
    recommendations.push('Continue monitoring across subsequent training cycles.');
  }

  return Object.freeze({
    task: dataset.task,
    totalExamples,
    averageConfidence01,
    conflictingEvidenceRate01,
    weakEvidenceRate01,
    labelEntropy01,
    coverageRate01,
    topLabels: Object.freeze(topLabels),
    lowConfidenceExamples: Object.freeze(lowConfidenceExamples),
    conflictingExamples: Object.freeze(conflictingExamples),
    qualityScore01,
    findings: Object.freeze(uniqueStrings(findings)),
    recommendations: Object.freeze(uniqueStrings(recommendations)),
  });
}

// ============================================================================
// MARK: Label audit record
// ============================================================================

export interface LabelAuditRecord {
  readonly exampleId: string;
  readonly task: TrainingTaskKey;
  readonly split: TrainingSplit;
  readonly primaryLabel: string;
  readonly secondaryLabels: readonly string[];
  readonly confidence01: number;
  readonly evidenceWeight01: number;
  readonly conflictingEvidence: boolean;
  readonly evidenceCount: number;
  readonly scalarTargetCount: number;
  readonly booleanTargetCount: number;
  readonly categoricalTargetCount: number;
  readonly rationaleLines: number;
  readonly inferenceCount: number;
  readonly replayCount: number;
  readonly auditedAt: number;
}

export function buildLabelAuditRecord(example: LabeledTrainingExample): LabelAuditRecord {
  return Object.freeze({
    exampleId: example.id,
    task: example.task,
    split: example.split,
    primaryLabel: example.labels.primaryLabel,
    secondaryLabels: example.labels.secondaryLabels,
    confidence01: example.labels.confidence01,
    evidenceWeight01: scoreEvidenceWeight(example.labels.evidence),
    conflictingEvidence: example.labels.conflictingEvidence,
    evidenceCount: example.labels.evidence.length,
    scalarTargetCount: Object.keys(example.labels.scalarTargets).length,
    booleanTargetCount: Object.keys(example.labels.booleanTargets).length,
    categoricalTargetCount: Object.keys(example.labels.categoricalTargets).length,
    rationaleLines: example.labels.rationale.length,
    inferenceCount: example.window.inferenceSnapshots.length,
    replayCount: example.window.replayArtifacts.length,
    auditedAt: Date.now(),
  });
}

export function buildLabelAuditRecords(dataset: LabeledTaskDataset): readonly LabelAuditRecord[] {
  return Object.freeze(dataset.examples.map(buildLabelAuditRecord));
}

export function exportLabelAuditNdjson(records: readonly LabelAuditRecord[]): string {
  return records.map((record) => JSON.stringify(record)).join('\n');
}

// ============================================================================
// MARK: Label calibration profile
// ============================================================================

export interface LabelCalibrationBucket {
  readonly minConfidence01: number;
  readonly maxConfidence01: number;
  readonly exampleCount: number;
  readonly empiricalAccuracy01: number;
  readonly predictedMeanConfidence01: number;
  readonly calibrationError01: number;
}

export interface LabelCalibrationProfile {
  readonly task: TrainingTaskKey;
  readonly buckets: readonly LabelCalibrationBucket[];
  readonly overallCalibrationError01: number;
  readonly overallAccuracy01: number;
  readonly isWellCalibrated: boolean;
}

export function buildLabelCalibrationProfile(
  dataset: LabeledTaskDataset,
  predictFn: (example: LabeledTrainingExample) => { readonly predictedLabel: string; readonly confidence01: number },
  bucketCount = 10,
): LabelCalibrationProfile {
  const examples = dataset.examples;
  const bucketsAcc = Array.from(
    { length: bucketCount },
    () => ({ count: 0, confidenceSum: 0, correctCount: 0 }),
  );

  let overallCorrect = 0;
  for (const example of examples) {
    const prediction = predictFn(example);
    const bucketIndex = Math.min(bucketCount - 1, Math.floor(clamp01(prediction.confidence01) * bucketCount));
    bucketsAcc[bucketIndex].count += 1;
    bucketsAcc[bucketIndex].confidenceSum += prediction.confidence01;
    if (prediction.predictedLabel === example.labels.primaryLabel) {
      bucketsAcc[bucketIndex].correctCount += 1;
      overallCorrect += 1;
    }
  }

  const buckets: LabelCalibrationBucket[] = bucketsAcc.map((bucket, index) => {
    const minConfidence01 = index / bucketCount;
    const maxConfidence01 = (index + 1) / bucketCount;
    const empiricalAccuracy01 = bucket.count > 0 ? bucket.correctCount / bucket.count : 0;
    const predictedMeanConfidence01 = bucket.count > 0
      ? bucket.confidenceSum / bucket.count
      : (minConfidence01 + maxConfidence01) / 2;
    return Object.freeze({
      minConfidence01,
      maxConfidence01,
      exampleCount: bucket.count,
      empiricalAccuracy01,
      predictedMeanConfidence01,
      calibrationError01: Math.abs(predictedMeanConfidence01 - empiricalAccuracy01),
    });
  });

  const filledBuckets = buckets.filter((b) => b.exampleCount > 0);
  const overallCalibrationError01 = average(filledBuckets.map((b) => b.calibrationError01));
  const overallAccuracy01 = examples.length > 0 ? overallCorrect / examples.length : 0;

  return Object.freeze({
    task: dataset.task,
    buckets: Object.freeze(buckets),
    overallCalibrationError01,
    overallAccuracy01,
    isWellCalibrated: overallCalibrationError01 < 0.1,
  });
}

// ============================================================================
// MARK: Label batch processor
// ============================================================================

export interface LabelBatchSummary {
  readonly taskCount: number;
  readonly totalExamples: number;
  readonly qualityReports: Readonly<Record<TrainingTaskKey, LabelQualityReport>>;
  readonly auditCounts: Readonly<Record<TrainingTaskKey, number>>;
  readonly overallQualityScore01: number;
  readonly overallAverageConfidence01: number;
  readonly taskReadiness: Readonly<Record<TrainingTaskKey, boolean>>;
  readonly summary: readonly string[];
}

export class LabelBatchProcessor {
  private readonly assembler: LabelAssembler;

  public constructor(options: LabelAssemblyOptions = {}) {
    this.assembler = new LabelAssembler(options);
  }

  public assembleAndAssess(corpus: TrainingCorpus): {
    readonly labeled: LabeledTrainingCorpus;
    readonly summary: LabelBatchSummary;
  } {
    const labeled = this.assembler.assembleCorpus(corpus);
    const summary = this.buildBatchSummary(labeled);
    return Object.freeze({ labeled, summary });
  }

  public buildBatchSummary(labeled: LabeledTrainingCorpus): LabelBatchSummary {
    const tasks = Object.keys(labeled.tasks) as TrainingTaskKey[];
    const qualityReports = {} as Record<TrainingTaskKey, LabelQualityReport>;
    const auditCounts = {} as Record<TrainingTaskKey, number>;
    const taskReadiness = {} as Record<TrainingTaskKey, boolean>;
    const allQualityScores: number[] = [];
    const allConfidences: number[] = [];
    let totalExamples = 0;

    for (const task of tasks) {
      const dataset = labeled.tasks[task];
      qualityReports[task] = assessLabelQuality(dataset);
      auditCounts[task] = dataset.examples.length;
      taskReadiness[task] =
        qualityReports[task].qualityScore01 >= 0.55 && dataset.examples.length >= 10;
      totalExamples += dataset.examples.length;
      allQualityScores.push(qualityReports[task].qualityScore01);
      allConfidences.push(qualityReports[task].averageConfidence01);
    }

    const overallQualityScore01 = average(allQualityScores);
    const overallAverageConfidence01 = average(allConfidences);
    const summary: string[] = [];
    const readyCount = Object.values(taskReadiness).filter(Boolean).length;
    summary.push(`${readyCount}/${tasks.length} tasks meet labeling readiness threshold.`);
    if (overallQualityScore01 < 0.55) {
      summary.push('Overall label quality is below target — review evidence chain depth.');
    }
    if (overallAverageConfidence01 < 0.5) {
      summary.push('Average confidence is low — consider widening the post-anchor evidence window.');
    }

    return Object.freeze({
      taskCount: tasks.length,
      totalExamples,
      qualityReports: Object.freeze(qualityReports),
      auditCounts: Object.freeze(auditCounts),
      overallQualityScore01,
      overallAverageConfidence01,
      taskReadiness: Object.freeze(taskReadiness),
      summary: Object.freeze(uniqueStrings(summary)),
    });
  }

  public exportBatchAuditNdjson(labeled: LabeledTrainingCorpus, task: TrainingTaskKey): string {
    const records = buildLabelAuditRecords(labeled.tasks[task]);
    return exportLabelAuditNdjson(records);
  }
}

// ============================================================================
// MARK: Label continuity bridge
// ============================================================================

export interface LabelContinuityRecord {
  readonly exampleId: string;
  readonly task: TrainingTaskKey;
  readonly primaryLabel: string;
  readonly inferenceDecisions: readonly InferenceLabelDecision[];
  readonly inferenceAcceptanceRate01: number;
  readonly continuityScore01: number;
  readonly replayCount: number;
  readonly proofCount: number;
}

export function buildLabelContinuityRecord(
  example: LabeledTrainingExample,
): LabelContinuityRecord {
  const inferenceDecisions = batchBuildInferenceLabelDecisions(
    example.window.inferenceSnapshots,
    example.window,
  );
  const acceptance = inferenceAcceptanceRate01(inferenceDecisions);
  const continuityScore01 = clamp01(
    (example.labels.confidence01 * 0.45)
    + (inferenceDecisions.length > 0 ? acceptance * 0.2 : 0)
    + (example.window.replayArtifacts.length > 0 ? 0.2 : 0)
    + (example.window.proofEdges.length > 0 ? 0.15 : 0),
  );

  return Object.freeze({
    exampleId: example.id,
    task: example.task,
    primaryLabel: example.labels.primaryLabel,
    inferenceDecisions,
    inferenceAcceptanceRate01: acceptance,
    continuityScore01,
    replayCount: example.window.replayArtifacts.length,
    proofCount: example.window.proofEdges.length,
  });
}

export function buildLabelContinuityRecords(
  dataset: LabeledTaskDataset,
): readonly LabelContinuityRecord[] {
  return Object.freeze(dataset.examples.map(buildLabelContinuityRecord));
}

// ============================================================================
// MARK: Label signal bundle — runtime integration point
// ============================================================================

export interface LabelSignalBundle {
  readonly task: TrainingTaskKey;
  readonly primaryLabel: string;
  readonly confidence01: number;
  readonly scalarTargets: Readonly<Record<string, number>>;
  readonly booleanTargets: Readonly<Record<string, boolean>>;
  readonly categoricalTargets: Readonly<Record<string, string | null>>;
  readonly evidenceWeight01: number;
  readonly qualityScore01: number;
  readonly continuityScore01: number;
  readonly inferenceCount: number;
  readonly replayCount: number;
  readonly proofCount: number;
  readonly builtAt: number;
}

export function buildLabelSignalBundle(example: LabeledTrainingExample): LabelSignalBundle {
  const continuity = buildLabelContinuityRecord(example);
  const evidenceWeight01 = scoreEvidenceWeight(example.labels.evidence);
  const qualityScore01 = clamp01(
    (example.labels.confidence01 * 0.4)
    + (evidenceWeight01 * 0.35)
    + (continuity.continuityScore01 * 0.25),
  );
  return Object.freeze({
    task: example.task,
    primaryLabel: example.labels.primaryLabel,
    confidence01: example.labels.confidence01,
    scalarTargets: example.labels.scalarTargets,
    booleanTargets: example.labels.booleanTargets,
    categoricalTargets: example.labels.categoricalTargets,
    evidenceWeight01,
    qualityScore01,
    continuityScore01: continuity.continuityScore01,
    inferenceCount: example.window.inferenceSnapshots.length,
    replayCount: example.window.replayArtifacts.length,
    proofCount: example.window.proofEdges.length,
    builtAt: Date.now(),
  });
}

// ============================================================================
// MARK: Label corpus diff
// ============================================================================

export interface LabelCorpusDiffEntry {
  readonly task: TrainingTaskKey;
  readonly priorExampleCount: number;
  readonly currentExampleCount: number;
  readonly deltaExamples: number;
  readonly priorAverageConfidence01: number;
  readonly currentAverageConfidence01: number;
  readonly deltaConfidence01: number;
  readonly priorTopLabel: string | null;
  readonly currentTopLabel: string | null;
  readonly topLabelChanged: boolean;
}

export interface LabelCorpusDiff {
  readonly diffedAt: number;
  readonly tasks: Readonly<Record<TrainingTaskKey, LabelCorpusDiffEntry>>;
  readonly overallExampleDelta: number;
  readonly overallConfidenceDelta01: number;
  readonly tasksWithLabelShift: readonly TrainingTaskKey[];
}

export function diffLabeledCorpora(
  prior: LabeledTrainingCorpus,
  current: LabeledTrainingCorpus,
): LabelCorpusDiff {
  const allTasks = [
    ...new Set([
      ...Object.keys(prior.tasks) as TrainingTaskKey[],
      ...Object.keys(current.tasks) as TrainingTaskKey[],
    ]),
  ];

  const tasks = {} as Record<TrainingTaskKey, LabelCorpusDiffEntry>;
  const tasksWithLabelShift: TrainingTaskKey[] = [];
  let overallExampleDelta = 0;
  let overallConfidenceDelta01 = 0;
  let taskCount = 0;

  for (const task of allTasks) {
    const priorDataset = prior.tasks[task];
    const currentDataset = current.tasks[task];
    const priorExampleCount = priorDataset?.examples.length ?? 0;
    const currentExampleCount = currentDataset?.examples.length ?? 0;
    const priorAverageConfidence01 = average(priorDataset?.examples.map((ex) => ex.labels.confidence01) ?? []);
    const currentAverageConfidence01 = average(currentDataset?.examples.map((ex) => ex.labels.confidence01) ?? []);
    const priorTopLabel = resolveTopLabel(priorDataset?.examples ?? []);
    const currentTopLabel = resolveTopLabel(currentDataset?.examples ?? []);
    const topLabelChanged = priorTopLabel !== currentTopLabel;
    if (topLabelChanged) tasksWithLabelShift.push(task);

    tasks[task] = Object.freeze({
      task,
      priorExampleCount,
      currentExampleCount,
      deltaExamples: currentExampleCount - priorExampleCount,
      priorAverageConfidence01,
      currentAverageConfidence01,
      deltaConfidence01: currentAverageConfidence01 - priorAverageConfidence01,
      priorTopLabel,
      currentTopLabel,
      topLabelChanged,
    });

    overallExampleDelta += currentExampleCount - priorExampleCount;
    overallConfidenceDelta01 += currentAverageConfidence01 - priorAverageConfidence01;
    taskCount += 1;
  }

  return Object.freeze({
    diffedAt: Date.now(),
    tasks: Object.freeze(tasks),
    overallExampleDelta,
    overallConfidenceDelta01: taskCount > 0 ? overallConfidenceDelta01 / taskCount : 0,
    tasksWithLabelShift: Object.freeze(tasksWithLabelShift),
  });
}

// ============================================================================
// MARK: Label export utilities
// ============================================================================

export interface LabelExportRow {
  readonly id: string;
  readonly task: TrainingTaskKey;
  readonly split: TrainingSplit;
  readonly primaryLabel: string;
  readonly confidence01: number;
  readonly evidenceWeight01: number;
  readonly conflictingEvidence: boolean;
  readonly scalarSummary: string;
  readonly booleanSummary: string;
  readonly categoricalSummary: string;
}

export function buildLabelExportRow(example: LabeledTrainingExample): LabelExportRow {
  const scalarSummary = Object.entries(example.labels.scalarTargets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value.toFixed(3)}`)
    .join(',');

  const booleanSummary = Object.entries(example.labels.booleanTargets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${boolean_to_int(value)}`)
    .join(',');

  const categoricalSummary = Object.entries(example.labels.categoricalTargets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value ?? 'null'}`)
    .join(',');

  return Object.freeze({
    id: example.id,
    task: example.task,
    split: example.split,
    primaryLabel: example.labels.primaryLabel,
    confidence01: example.labels.confidence01,
    evidenceWeight01: scoreEvidenceWeight(example.labels.evidence),
    conflictingEvidence: example.labels.conflictingEvidence,
    scalarSummary,
    booleanSummary,
    categoricalSummary,
  });
}

export function exportLabeledDatasetCsv(dataset: LabeledTaskDataset): string {
  const header = 'id,task,split,primaryLabel,confidence01,evidenceWeight01,conflictingEvidence';
  const rows = dataset.examples.map((example) => {
    const row = buildLabelExportRow(example);
    return [
      row.id, row.task, row.split, row.primaryLabel,
      row.confidence01.toFixed(4),
      row.evidenceWeight01.toFixed(4),
      String(row.conflictingEvidence),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function exportLabeledCorpusManifestJson(corpus: LabeledTrainingCorpus): string {
  const tasks = Object.keys(corpus.tasks) as TrainingTaskKey[];
  const manifest = {
    ...corpus.manifest,
    tasks: tasks.map((task) => ({
      task,
      exampleCount: corpus.tasks[task].examples.length,
      bySplit: {
        TRAIN: corpus.tasks[task].bySplit.TRAIN.length,
        VALIDATION: corpus.tasks[task].bySplit.VALIDATION.length,
        TEST: corpus.tasks[task].bySplit.TEST.length,
      },
      stats: corpus.tasks[task].stats,
    })),
  };
  return JSON.stringify(manifest, null, 2);
}

// ============================================================================
// MARK: Label pressure projection
// ============================================================================

export interface LabelPressureProjection {
  readonly task: TrainingTaskKey;
  readonly pressureScore01: number;
  readonly dominantLabelPressure01: number;
  readonly conflictPressure01: number;
  readonly weaknessPressure01: number;
  readonly signalStrength01: number;
  readonly pressureBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly projectedDriftRisk01: number;
}

export function projectLabelPressure(dataset: LabeledTaskDataset): LabelPressureProjection {
  const examples = dataset.examples;
  if (examples.length === 0) {
    return Object.freeze({
      task: dataset.task,
      pressureScore01: 0,
      dominantLabelPressure01: 0,
      conflictPressure01: 0,
      weaknessPressure01: 0,
      signalStrength01: 0,
      pressureBand: 'LOW',
      projectedDriftRisk01: 0,
    });
  }

  const labelCounts = new Map<string, number>();
  for (const ex of examples) {
    labelCounts.set(ex.labels.primaryLabel, (labelCounts.get(ex.labels.primaryLabel) ?? 0) + 1);
  }
  const sorted = [...labelCounts.values()].sort((a, b) => b - a);
  const dominantProportion = sorted[0] / examples.length;
  const dominantLabelPressure01 = clamp01((dominantProportion - 0.5) * 2);

  const conflictPressure01 = examples.filter((ex) => ex.labels.conflictingEvidence).length / examples.length;
  const weaknessPressure01 = examples.filter(
    (ex) => scoreEvidenceWeight(ex.labels.evidence) < 0.4,
  ).length / examples.length;
  const signalStrength01 = average(examples.map((ex) => ex.labels.confidence01));

  const pressureScore01 = clamp01(
    (dominantLabelPressure01 * 0.3)
    + (conflictPressure01 * 0.3)
    + (weaknessPressure01 * 0.25)
    + ((1 - signalStrength01) * 0.15),
  );

  const pressureBand: LabelPressureProjection['pressureBand'] =
    pressureScore01 >= 0.75 ? 'CRITICAL'
    : pressureScore01 >= 0.5 ? 'HIGH'
    : pressureScore01 >= 0.25 ? 'MEDIUM'
    : 'LOW';

  return Object.freeze({
    task: dataset.task,
    pressureScore01,
    dominantLabelPressure01,
    conflictPressure01,
    weaknessPressure01,
    signalStrength01,
    pressureBand,
    projectedDriftRisk01: clamp01(pressureScore01 * 0.7 + (1 - signalStrength01) * 0.3),
  });
}

export function projectLabelPressureAll(
  corpus: LabeledTrainingCorpus,
): Readonly<Record<TrainingTaskKey, LabelPressureProjection>> {
  const result = {} as Record<TrainingTaskKey, LabelPressureProjection>;
  for (const task of Object.keys(corpus.tasks) as TrainingTaskKey[]) {
    result[task] = projectLabelPressure(corpus.tasks[task]);
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Label window quality
// ============================================================================

export interface LabelWindowQuality {
  readonly exampleId: string;
  readonly task: TrainingTaskKey;
  readonly preMessageCount: number;
  readonly anchorMessageCount: number;
  readonly postMessageCount: number;
  readonly telemetryCount: number;
  readonly replayCount: number;
  readonly inferenceCount: number;
  readonly proofCount: number;
  readonly evidenceCount: number;
  readonly windowDepthScore01: number;
  readonly isWindowSufficient: boolean;
}

export function assessWindowQuality(example: LabeledTrainingExample): LabelWindowQuality {
  const pre = example.window.preMessages.length;
  const anchor = example.window.anchorMessages.length;
  const post = example.window.postMessages.length;
  const telemetry = example.window.telemetry.length;
  const replay = example.window.replayArtifacts.length;
  const inference = example.window.inferenceSnapshots.length;
  const proof = example.window.proofEdges.length;
  const evidence = example.window.evidence.length;

  const windowDepthScore01 = clamp01(
    (Math.min(pre, 5) / 5) * 0.1
    + (anchor > 0 ? 0.15 : 0)
    + (Math.min(post, 5) / 5) * 0.2
    + (Math.min(telemetry, 4) / 4) * 0.2
    + (replay > 0 ? 0.15 : 0)
    + (inference > 0 ? 0.1 : 0)
    + (proof > 0 ? 0.05 : 0)
    + (Math.min(evidence, 3) / 3) * 0.05,
  );

  return Object.freeze({
    exampleId: example.id,
    task: example.task,
    preMessageCount: pre,
    anchorMessageCount: anchor,
    postMessageCount: post,
    telemetryCount: telemetry,
    replayCount: replay,
    inferenceCount: inference,
    proofCount: proof,
    evidenceCount: evidence,
    windowDepthScore01,
    isWindowSufficient: windowDepthScore01 >= 0.35 && anchor > 0,
  });
}

export function assessWindowQualityAll(
  dataset: LabeledTaskDataset,
): readonly LabelWindowQuality[] {
  return Object.freeze(dataset.examples.map(assessWindowQuality));
}

export function windowQualityRate01(dataset: LabeledTaskDataset): number {
  const quals = assessWindowQualityAll(dataset);
  if (quals.length === 0) return 0;
  return quals.filter((q) => q.isWindowSufficient).length / quals.length;
}

// ============================================================================
// MARK: Cross-task label analysis
// ============================================================================

export interface LabelCrossTaskSummary {
  readonly analyzedAt: number;
  readonly taskCount: number;
  readonly tasks: readonly TrainingTaskKey[];
  readonly totalExamples: number;
  readonly averageQualityScore01: number;
  readonly averageConfidence01: number;
  readonly averageWindowDepthScore01: number;
  readonly tasksAboveQualityThreshold: readonly TrainingTaskKey[];
  readonly tasksBelowQualityThreshold: readonly TrainingTaskKey[];
  readonly pressureProfiles: Readonly<Record<TrainingTaskKey, LabelPressureProjection>>;
}

export function buildLabelCrossTaskSummary(corpus: LabeledTrainingCorpus): LabelCrossTaskSummary {
  const tasks = Object.keys(corpus.tasks) as TrainingTaskKey[];
  const qualityScores: number[] = [];
  const confidences: number[] = [];
  const windowScores: number[] = [];
  const above: TrainingTaskKey[] = [];
  const below: TrainingTaskKey[] = [];
  let totalExamples = 0;

  for (const task of tasks) {
    const dataset = corpus.tasks[task];
    const quality = assessLabelQuality(dataset);
    const windowQuals = assessWindowQualityAll(dataset);

    qualityScores.push(quality.qualityScore01);
    confidences.push(quality.averageConfidence01);
    windowScores.push(average(windowQuals.map((q) => q.windowDepthScore01)));
    totalExamples += dataset.examples.length;

    if (quality.qualityScore01 >= 0.55) {
      above.push(task);
    } else {
      below.push(task);
    }
  }

  return Object.freeze({
    analyzedAt: Date.now(),
    taskCount: tasks.length,
    tasks: Object.freeze(tasks),
    totalExamples,
    averageQualityScore01: average(qualityScores),
    averageConfidence01: average(confidences),
    averageWindowDepthScore01: average(windowScores),
    tasksAboveQualityThreshold: Object.freeze(above),
    tasksBelowQualityThreshold: Object.freeze(below),
    pressureProfiles: projectLabelPressureAll(corpus),
  });
}

// ============================================================================
// MARK: Additional private utilities
// ============================================================================

function shannonEntropy(probabilities: readonly number[]): number {
  const filtered = probabilities.filter((p) => p > 0);
  if (filtered.length === 0) return 0;
  const total = filtered.reduce((sum, p) => sum + p, 0);
  if (total <= 0) return 0;
  const normalized = filtered.map((p) => p / total);
  const maxEntropy = Math.log2(normalized.length);
  if (maxEntropy <= 0) return 0;
  const entropy = -normalized.reduce((sum, p) => sum + p * Math.log2(Math.max(p, 1e-9)), 0);
  return clamp01(entropy / maxEntropy);
}

function resolveTopLabel(examples: readonly LabeledTrainingExample[]): string | null {
  if (examples.length === 0) return null;
  const counts = new Map<string, number>();
  for (const ex of examples) {
    counts.set(ex.labels.primaryLabel, (counts.get(ex.labels.primaryLabel) ?? 0) + 1);
  }
  let topLbl = '';
  let topCount = 0;
  for (const [label, count] of counts.entries()) {
    if (count > topCount) { topLbl = label; topCount = count; }
  }
  return topLbl || null;
}

// ============================================================================
// MARK: Label readiness gate
// ============================================================================

export type LabelReadinessGate =
  | 'READY_FOR_TRAINING'
  | 'READY_GUARDED'
  | 'NEEDS_MORE_DATA'
  | 'NEEDS_QUALITY_IMPROVEMENT'
  | 'NOT_READY';

export interface LabelReadinessDecision {
  readonly task: TrainingTaskKey;
  readonly gate: LabelReadinessGate;
  readonly exampleCount: number;
  readonly qualityScore01: number;
  readonly windowDepthScore01: number;
  readonly pressureScore01: number;
  readonly reasons: readonly string[];
  readonly actions: readonly string[];
}

export function decideLabelReadiness(
  dataset: LabeledTaskDataset,
  minExamples = 30,
): LabelReadinessDecision {
  const quality = assessLabelQuality(dataset);
  const windowQuals = assessWindowQualityAll(dataset);
  const windowDepthScore01 = average(windowQuals.map((q) => q.windowDepthScore01));
  const pressure = projectLabelPressure(dataset);
  const exampleCount = dataset.examples.length;

  const reasons: string[] = [];
  const actions: string[] = [];

  if (exampleCount < minExamples) {
    reasons.push(`Only ${exampleCount} examples — minimum is ${minExamples}.`);
    actions.push('Register more authoritative room artifacts and rebuild corpus.');
  }
  if (quality.qualityScore01 < 0.45) {
    reasons.push(`Quality score ${quality.qualityScore01.toFixed(3)} is below acceptable floor.`);
    actions.push('Improve evidence chain depth and anchor selection quality.');
  }
  if (windowDepthScore01 < 0.3) {
    reasons.push(`Window depth score ${windowDepthScore01.toFixed(3)} indicates shallow context.`);
    actions.push('Widen post-anchor window and include telemetry + replay artifacts.');
  }
  if (pressure.pressureBand === 'CRITICAL' || pressure.pressureBand === 'HIGH') {
    reasons.push(`Label pressure is ${pressure.pressureBand}.`);
    actions.push('Balance label distribution and reduce dominant-class concentration.');
  }

  let gate: LabelReadinessGate;
  if (exampleCount < minExamples || quality.qualityScore01 < 0.35) {
    gate = exampleCount < minExamples ? 'NEEDS_MORE_DATA' : 'NEEDS_QUALITY_IMPROVEMENT';
  } else if (quality.qualityScore01 >= 0.65 && windowDepthScore01 >= 0.4 && pressure.pressureScore01 < 0.4) {
    gate = 'READY_FOR_TRAINING';
  } else if (quality.qualityScore01 >= 0.5 && exampleCount >= minExamples) {
    gate = 'READY_GUARDED';
  } else {
    gate = 'NOT_READY';
  }

  if (reasons.length === 0) {
    reasons.push('All quality gates cleared.');
    actions.push('Proceed to policy training.');
  }

  return Object.freeze({
    task: dataset.task,
    gate,
    exampleCount,
    qualityScore01: quality.qualityScore01,
    windowDepthScore01,
    pressureScore01: pressure.pressureScore01,
    reasons: Object.freeze(uniqueStrings(reasons)),
    actions: Object.freeze(uniqueStrings(actions)),
  });
}

export function decideLabelReadinessAll(
  corpus: LabeledTrainingCorpus,
  minExamples = 30,
): Readonly<Record<TrainingTaskKey, LabelReadinessDecision>> {
  const result = {} as Record<TrainingTaskKey, LabelReadinessDecision>;
  for (const task of Object.keys(corpus.tasks) as TrainingTaskKey[]) {
    result[task] = decideLabelReadiness(corpus.tasks[task], minExamples);
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const CHAT_LABEL_ASSEMBLER_VERSION = '2026.03.14' as const;

export const LABEL_TASK_KEYS: readonly TrainingTaskKey[] = Object.freeze([
  'ENGAGEMENT',
  'HATER_TARGETING',
  'HELPER_TIMING',
  'CHANNEL_AFFINITY',
  'TOXICITY_RISK',
  'CHURN_RISK',
  'INTERVENTION_POLICY',
  'RESPONSE_RANKING',
  'SEQUENCE_MEMORY',
  'MODERATION_OUTCOME',
]);

export const ChatLabelAssemblerModule = Object.freeze({
  version: CHAT_LABEL_ASSEMBLER_VERSION,
  taskKeys: LABEL_TASK_KEYS,
  LabelAssembler,
  LabelBatchProcessor,
  assessLabelQuality,
  buildLabelAuditRecord,
  buildLabelAuditRecords,
  buildLabelCalibrationProfile,
  buildLabelContinuityRecord,
  buildLabelContinuityRecords,
  buildLabelSignalBundle,
  buildLabelExportRow,
  exportLabeledDatasetCsv,
  exportLabeledCorpusManifestJson,
  exportLabelAuditNdjson,
  diffLabeledCorpora,
  projectLabelPressure,
  projectLabelPressureAll,
  assessWindowQuality,
  assessWindowQualityAll,
  windowQualityRate01,
  buildLabelCrossTaskSummary,
  decideLabelReadiness,
  decideLabelReadinessAll,
  buildInferenceLabelDecision,
  batchBuildInferenceLabelDecisions,
  inferenceAcceptanceRate01,
  inferenceAverageScore01,
});
