/**
 * @file pzo-web/src/engines/chat/dealroom/OfferPressureScorer.ts
 *
 * Frontend pressure scoring for offer presentation, revision pressure, channel spillover,
 * time pressure, concession asymmetry, proof appetite, leak exposure, and rescue-linked
 * decision risk inside DEAL_ROOM threads.
 *
 * Doctrine:
 * - score the pressure of the offer, not merely the positivity of the language
 * - expose explanation trees so UI surfaces can show exactly why an offer is "hot"
 * - keep scoring stable enough for repeated re-renders and transcript replay
 * - let the score drive banners, proof cards, helper prompts, and timed delay theater
 */

import type {
  ChatNegotiationConcession,
  ChatNegotiationEscalationState,
  ChatNegotiationMemoryCue,
  ChatNegotiationPressureModel,
  ChatNegotiationRescueState,
  ChatNegotiationThread,
  ChatNegotiationWindow,
} from '../../../../../shared/contracts/chat/ChatNegotiation';
import type {
  ChatOffer,
  ChatOfferAnchor,
  ChatOfferDirection,
  ChatOfferExposure,
  ChatOfferGuarantee,
  ChatOfferPressureEnvelope,
  ChatOfferProofPolicy,
  ChatOfferTerm,
  ChatOfferVersion,
} from '../../../../../shared/contracts/chat/ChatOffer';
import type { ChatMessageLike } from '../types';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type OfferPressureDimension =
  | 'PRICE'
  | 'TIME'
  | 'SOCIAL'
  | 'LEAK'
  | 'PROOF'
  | 'ESCALATION'
  | 'CONCESSION'
  | 'VISIBILITY'
  | 'RESCUE'
  | 'REVISION';

export interface OfferPressureReason {
  readonly dimension: OfferPressureDimension;
  readonly code:
    | 'ANCHOR_STRETCH'
    | 'DEADLINE'
    | 'LEAK_SURFACE'
    | 'PROOF_WITHHELD'
    | 'PROOF_OVERLOAD'
    | 'SOCIAL_AUDIENCE'
    | 'ESCALATION_STAGE'
    | 'RESCUE_LINK'
    | 'CONCESSION_SWING'
    | 'REVISION_CHURN'
    | 'VISIBILITY_LOCK'
    | 'MESSAGE_PRESSURE'
    | 'WINDOW_STRESS'
    | 'UNKNOWN';
  readonly weight: number;
  readonly detail: string;
  readonly evidence?: JsonValue;
}

export interface OfferPressureScore {
  readonly offerId: string;
  readonly versionId: string;
  readonly total: number;
  readonly pressureBand: 'CALM' | 'WATCHFUL' | 'PRESSURED' | 'CRITICAL' | 'BREAKPOINT';
  readonly dimensions: Readonly<Record<OfferPressureDimension, number>>;
  readonly reasons: readonly OfferPressureReason[];
  readonly helpers: readonly string[];
  readonly blockers: readonly string[];
  readonly summary: readonly string[];
  readonly debug?: JsonValue;
}

export interface OfferPressureScorerConfig {
  readonly deadlineAmplifier: number;
  readonly leakAmplifier: number;
  readonly proofAmplifier: number;
  readonly rescueAmplifier: number;
  readonly revisionAmplifier: number;
  readonly audienceAmplifier: number;
  readonly debug: boolean;
}

export const DEFAULT_OFFER_PRESSURE_SCORER_CONFIG: OfferPressureScorerConfig = Object.freeze({
  deadlineAmplifier: 1.18,
  leakAmplifier: 1.12,
  proofAmplifier: 1.1,
  rescueAmplifier: 1.17,
  revisionAmplifier: 1.15,
  audienceAmplifier: 1.08,
  debug: false,
});

const PRESSURE_DIMENSIONS: readonly OfferPressureDimension[] = Object.freeze([
  'PRICE',
  'TIME',
  'SOCIAL',
  'LEAK',
  'PROOF',
  'ESCALATION',
  'CONCESSION',
  'VISIBILITY',
  'RESCUE',
  'REVISION',
]);

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toBand(score: number): OfferPressureScore['pressureBand'] {
  if (score >= 0.84) return 'BREAKPOINT';
  if (score >= 0.68) return 'CRITICAL';
  if (score >= 0.48) return 'PRESSURED';
  if (score >= 0.24) return 'WATCHFUL';
  return 'CALM';
}

function safeArray<T>(value: readonly T[] | undefined | null): T[] {
  return Array.isArray(value) ? [...value] : [];
}

function immutableRecord<T extends string, V>(keys: readonly T[], factory: (key: T) => V): Readonly<Record<T, V>> {
  return Object.freeze(
    keys.reduce((acc, key) => {
      acc[key] = factory(key);
      return acc;
    }, {} as Record<T, V>),
  );
}

function scoreAnchor(anchor: ChatOfferAnchor | undefined | null): number {
  if (!anchor) return 0;
  const label = toText((anchor as { label?: string }).label);
  const strategy = toText((anchor as { strategy?: string }).strategy);
  let total = 0.08;
  if (label.includes('floor') || label.includes('ceiling')) total += 0.08;
  if (strategy.includes('aggressive')) total += 0.12;
  if (strategy.includes('scarcity')) total += 0.1;
  return clamp01(total);
}

function scoreGuarantees(guarantees: readonly ChatOfferGuarantee[] | undefined | null): number {
  const items = safeArray(guarantees);
  if (!items.length) return 0;
  return clamp01(
    sum(
      items.map((guarantee) => {
        const label = toText((guarantee as { label?: string }).label);
        let weight = 0.04;
        if (label.includes('no refund')) weight += 0.11;
        if (label.includes('liquidated damages')) weight += 0.13;
        if (label.includes('exclusive')) weight += 0.08;
        return weight;
      }),
    ),
  );
}

function scoreExposure(exposure: ChatOfferExposure | undefined | null): number {
  if (!exposure) return 0;
  const raw = JSON.stringify(exposure).toLowerCase();
  let value = 0.05;
  if (raw.includes('public')) value += 0.14;
  if (raw.includes('syndicate')) value += 0.11;
  if (raw.includes('leak')) value += 0.12;
  if (raw.includes('screenshot')) value += 0.09;
  return clamp01(value);
}

function scoreProofPolicy(policy: ChatOfferProofPolicy | undefined | null): number {
  if (!policy) return 0;
  const raw = JSON.stringify(policy).toLowerCase();
  let value = 0.04;
  if (raw.includes('required')) value += 0.08;
  if (raw.includes('before')) value += 0.06;
  if (raw.includes('withheld')) value += 0.12;
  if (raw.includes('delayed')) value += 0.08;
  return clamp01(value);
}

function scoreTerms(terms: readonly ChatOfferTerm[] | undefined | null): number {
  const items = safeArray(terms);
  if (!items.length) return 0;
  let total = 0;
  for (const term of items) {
    const label = toText((term as { label?: string }).label);
    const valueText = toText((term as { valueText?: string }).valueText);
    if (label.includes('deadline') || valueText.includes('today')) total += 0.12;
    if (label.includes('refund') || valueText.includes('non-refundable')) total += 0.14;
    if (label.includes('exclusive')) total += 0.08;
    if (label.includes('visibility') || valueText.includes('private')) total += 0.07;
    if (label.includes('proof') || valueText.includes('verification')) total += 0.06;
  }
  return clamp01(total);
}

function scoreConcessions(concessions: readonly ChatNegotiationConcession[] | undefined | null): number {
  const items = safeArray(concessions);
  if (!items.length) return 0;
  let total = 0;
  for (const item of items) {
    const label = toText((item as { label?: string }).label);
    if (label.includes('price')) total += 0.1;
    else if (label.includes('deadline')) total += 0.08;
    else if (label.includes('shipping') || label.includes('delivery')) total += 0.06;
    else total += 0.04;
  }
  return clamp01(total);
}

export class OfferPressureScorer {
  private readonly config: OfferPressureScorerConfig;

  public constructor(config: Partial<OfferPressureScorerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_OFFER_PRESSURE_SCORER_CONFIG,
      ...config,
    });
  }

  public score(params: {
    offer: ChatOffer | ChatOfferVersion;
    thread?: Partial<ChatNegotiationThread> | null;
    window?: ChatNegotiationWindow | null;
    rescueState?: ChatNegotiationRescueState | null;
    pressureModel?: ChatNegotiationPressureModel | null;
    transcriptTail?: readonly ChatMessageLike[] | null;
    memoryCues?: readonly ChatNegotiationMemoryCue[] | null;
  }): OfferPressureScore {
    const offer = params.offer as ChatOfferVersion;
    const thread = params.thread ?? null;
    const transcriptTail = safeArray(params.transcriptTail);
    const reasons: OfferPressureReason[] = [];

    const add = (
      dimension: OfferPressureDimension,
      code: OfferPressureReason['code'],
      weight: number,
      detail: string,
      evidence?: JsonValue,
    ) => {
      if (weight <= 0) return;
      reasons.push({
        dimension,
        code,
        weight: clamp01(weight),
        detail,
        evidence,
      });
    };

    const anchorScore = scoreAnchor((offer as { anchor?: ChatOfferAnchor }).anchor);
    const guaranteeScore = scoreGuarantees((offer as { guarantees?: ChatOfferGuarantee[] }).guarantees);
    const exposureScore = scoreExposure((offer as { exposure?: ChatOfferExposure }).exposure);
    const proofScore = scoreProofPolicy((offer as { proofPolicy?: ChatOfferProofPolicy }).proofPolicy);
    const termScore = scoreTerms((offer as { terms?: ChatOfferTerm[] }).terms);
    const concessionScore = scoreConcessions((offer as { concessions?: ChatNegotiationConcession[] }).concessions);

    if (anchorScore > 0.1) {
      add('PRICE', 'ANCHOR_STRETCH', anchorScore, 'Offer anchor suggests value stretching.', {
        anchor: (offer as { anchor?: ChatOfferAnchor }).anchor ?? null,
      });
    }

    if (termScore > 0.1) {
      add('TIME', 'DEADLINE', termScore * this.config.deadlineAmplifier, 'Offer terms introduce deadline/time compression.', {
        terms: (offer as { terms?: ChatOfferTerm[] }).terms ?? [],
      });
    }

    if (exposureScore > 0.08) {
      add('LEAK', 'LEAK_SURFACE', exposureScore * this.config.leakAmplifier, 'Offer exposure creates leak/social-spread pressure.', {
        exposure: (offer as { exposure?: ChatOfferExposure }).exposure ?? null,
      });
    }

    if (proofScore > 0.08) {
      const proofPolicy = (offer as { proofPolicy?: ChatOfferProofPolicy }).proofPolicy ?? null;
      add(
        'PROOF',
        JSON.stringify(proofPolicy).toLowerCase().includes('withheld') ? 'PROOF_WITHHELD' : 'PROOF_OVERLOAD',
        proofScore * this.config.proofAmplifier,
        'Proof policy changes the trust/verification burden of the offer.',
        proofPolicy as unknown as JsonValue,
      );
    }

    if (guaranteeScore > 0.08) {
      add('ESCALATION', 'ESCALATION_STAGE', guaranteeScore, 'Guarantee structure makes the offer feel harder to safely refuse.', {
        guarantees: (offer as { guarantees?: ChatOfferGuarantee[] }).guarantees ?? [],
      });
    }

    if (concessionScore > 0.08) {
      add('CONCESSION', 'CONCESSION_SWING', concessionScore, 'Concession pattern increases decision pressure.', {
        concessions: (offer as { concessions?: ChatNegotiationConcession[] }).concessions ?? [],
      });
    }

    const visibilityText = JSON.stringify((offer as { exposure?: ChatOfferExposure }).exposure ?? {}).toLowerCase();
    if (visibilityText.includes('private') || visibilityText.includes('exclusive')) {
      add('VISIBILITY', 'VISIBILITY_LOCK', 0.11, 'Offer visibility settings are narrowing social maneuver room.', {
        exposure: (offer as { exposure?: ChatOfferExposure }).exposure ?? null,
      });
    }

    if (params.rescueState) {
      add('RESCUE', 'RESCUE_LINK', 0.14 * this.config.rescueAmplifier, 'Active rescue state makes this offer higher pressure for the player.', params.rescueState as unknown as JsonValue);
    }

    if (params.pressureModel) {
      add('TIME', 'WINDOW_STRESS', 0.12, 'Negotiation pressure model reports active window stress.', params.pressureModel as unknown as JsonValue);
    }

    const stageText = JSON.stringify(thread ?? {}).toLowerCase();
    if (stageText.includes('exposed') || stageText.includes('crowd')) {
      add('SOCIAL', 'SOCIAL_AUDIENCE', 0.1 * this.config.audienceAmplifier, 'Thread state suggests social witness pressure.', thread as unknown as JsonValue);
    }

    if (params.window) {
      add('TIME', 'WINDOW_STRESS', 0.1, 'Negotiation window is active and contributes to reply pressure.', params.window as unknown as JsonValue);
    }

    const transcriptPressure = this.scoreTranscriptPressure(transcriptTail);
    if (transcriptPressure > 0.08) {
      add('SOCIAL', 'MESSAGE_PRESSURE', transcriptPressure, 'Recent transcript language increases local offer pressure.', {
        transcriptTail: transcriptTail.slice(-6).map((entry) => ({
          id: String((entry as Record<string, unknown>).id ?? 'unknown'),
          body: String((entry as Record<string, unknown>).body ?? ''),
        })),
      });
    }

    const revisionWeight = this.scoreRevisionPressure(transcriptTail, offer);
    if (revisionWeight > 0.08) {
      add('REVISION', 'REVISION_CHURN', revisionWeight * this.config.revisionAmplifier, 'Offer version churn is materially increasing pressure.', {
        versionId: (offer as { versionId?: string }).versionId ?? 'unknown',
      });
    }

    const dimensions = immutableRecord(PRESSURE_DIMENSIONS, (dimension) =>
      clamp01(sum(reasons.filter((reason) => reason.dimension === dimension).map((reason) => reason.weight))),
    );

    const total = clamp01(
      mean([
        dimensions.PRICE,
        dimensions.TIME,
        dimensions.SOCIAL,
        dimensions.LEAK,
        dimensions.PROOF,
        dimensions.ESCALATION,
        dimensions.CONCESSION,
        dimensions.VISIBILITY,
        dimensions.RESCUE,
        dimensions.REVISION,
      ]),
    );

    const helpers = this.buildHelpers(dimensions, total);
    const blockers = this.buildBlockers(dimensions, total);
    const summary = this.buildSummary(dimensions, total, reasons);

    return Object.freeze({
      offerId: String((offer as { id?: string }).id ?? 'unknown'),
      versionId: String((offer as { versionId?: string }).versionId ?? 'unknown'),
      total,
      pressureBand: toBand(total),
      dimensions,
      reasons: Object.freeze(reasons.sort((a, b) => b.weight - a.weight)),
      helpers: Object.freeze(helpers),
      blockers: Object.freeze(blockers),
      summary: Object.freeze(summary),
      debug: this.config.debug
        ? {
            thread,
            rescueState: params.rescueState ?? null,
            pressureModel: params.pressureModel ?? null,
            transcriptTailCount: transcriptTail.length,
          }
        : undefined,
    });
  }

  public compare(
    currentOffer: ChatOffer | ChatOfferVersion,
    previousOffer: ChatOffer | ChatOfferVersion | null | undefined,
  ): JsonValue {
    const current = this.score({ offer: currentOffer });
    const previous = previousOffer ? this.score({ offer: previousOffer }) : null;
    return {
      current: {
        total: current.total,
        band: current.pressureBand,
        helpers: current.helpers,
        blockers: current.blockers,
      },
      previous: previous
        ? {
            total: previous.total,
            band: previous.pressureBand,
          }
        : null,
      delta: previous ? Number((current.total - previous.total).toFixed(4)) : null,
    };
  }

  public toEnvelope(score: OfferPressureScore): ChatOfferPressureEnvelope {
    return Object.freeze({
      pressureScore: score.total,
      pressureBand: score.pressureBand,
      helperFlags: [...score.helpers],
      blockerFlags: [...score.blockers],
      summary: [...score.summary],
    }) as ChatOfferPressureEnvelope;
  }

  private scoreTranscriptPressure(entries: readonly ChatMessageLike[]): number {
    if (!entries.length) return 0;
    const tail = entries.slice(-8);
    let weight = 0;
    for (const entry of tail) {
      const body = toText((entry as Record<string, unknown>).body);
      if (body.includes('now') || body.includes('today') || body.includes('immediately')) weight += 0.06;
      if (body.includes('quiet') || body.includes('private') || body.includes('do not share')) weight += 0.06;
      if (body.includes('final') || body.includes('last offer')) weight += 0.07;
      if (body.includes('other buyers') || body.includes('other bidders')) weight += 0.05;
    }
    return clamp01(weight);
  }

  private scoreRevisionPressure(entries: readonly ChatMessageLike[], offer: ChatOfferVersion): number {
    if (!entries.length) return 0;
    const versionId = String((offer as { versionId?: string }).versionId ?? '');
    const mentionCount = entries
      .slice(-24)
      .filter((entry) => toText((entry as Record<string, unknown>).body).includes(versionId.toLowerCase()))
      .length;
    return clamp01(mentionCount * 0.06);
  }

  private buildHelpers(dimensions: Readonly<Record<OfferPressureDimension, number>>, total: number): string[] {
    const helpers: string[] = [];
    if (dimensions.OVERPAY !== undefined) {
      // compatibility guard for historic builds; dimensions object is fixed above.
    }
    if (dimensions.PRICE > 0.58) helpers.push('surface-price-anchor-context');
    if (dimensions.TIME > 0.55) helpers.push('offer-cooldown-before-send');
    if (dimensions.LEAK > 0.5) helpers.push('mask-proof-surface');
    if (dimensions.PROOF > 0.52) helpers.push('open-proof-comparison-card');
    if (dimensions.RESCUE > 0.48) helpers.push('helper-microcopy-override');
    if (total > 0.72) helpers.push('trigger-high-pressure-banner');
    return helpers;
  }

  private buildBlockers(dimensions: Readonly<Record<OfferPressureDimension, number>>, total: number): string[] {
    const blockers: string[] = [];
    if (dimensions.LEAK > 0.66) blockers.push('prevent-thread-exposure');
    if (dimensions.TIME > 0.72) blockers.push('block-immediate-accept-without-confirmation');
    if (dimensions.PROOF > 0.64) blockers.push('require-proof-review');
    if (dimensions.RESCUE > 0.62) blockers.push('require-helper-offer-review');
    if (total > 0.86) blockers.push('hard-stop-send');
    return blockers;
  }

  private buildSummary(
    dimensions: Readonly<Record<OfferPressureDimension, number>>,
    total: number,
    reasons: readonly OfferPressureReason[],
  ): string[] {
    const lines: string[] = [];
    lines.push(`total=${total.toFixed(2)} band=${toBand(total)}`);
    for (const dimension of PRESSURE_DIMENSIONS) {
      const value = dimensions[dimension];
      if (value < 0.15) continue;
      const top = reasons.find((reason) => reason.dimension === dimension);
      lines.push(`${dimension}:${value.toFixed(2)} via ${top?.code ?? 'UNKNOWN'}`);
    }
    return lines;
  }
}

export const OfferPressureScorerModule = Object.freeze({
  OfferPressureScorer,
  DEFAULT_OFFER_PRESSURE_SCORER_CONFIG,
  PRESSURE_DIMENSIONS,
  create(config: Partial<OfferPressureScorerConfig> = {}) {
    return new OfferPressureScorer(config);
  },
} as const);

export default OfferPressureScorer;

export function offerPressureScorerAppendixRule1(): string {
  return 'appendix-rule-1:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector1(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_1 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule2(): string {
  return 'appendix-rule-2:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector2(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_2 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule3(): string {
  return 'appendix-rule-3:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector3(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_3 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule4(): string {
  return 'appendix-rule-4:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector4(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_4 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule5(): string {
  return 'appendix-rule-5:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector5(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_5 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule6(): string {
  return 'appendix-rule-6:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector6(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_6 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule7(): string {
  return 'appendix-rule-7:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector7(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_7 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule8(): string {
  return 'appendix-rule-8:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector8(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_8 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule9(): string {
  return 'appendix-rule-9:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector9(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_9 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule10(): string {
  return 'appendix-rule-10:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector10(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_10 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule11(): string {
  return 'appendix-rule-11:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector11(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_11 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule12(): string {
  return 'appendix-rule-12:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector12(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_12 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule13(): string {
  return 'appendix-rule-13:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector13(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_13 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule14(): string {
  return 'appendix-rule-14:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector14(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_14 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule15(): string {
  return 'appendix-rule-15:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector15(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_15 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule16(): string {
  return 'appendix-rule-16:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector16(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_16 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule17(): string {
  return 'appendix-rule-17:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector17(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_17 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule18(): string {
  return 'appendix-rule-18:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector18(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_18 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);

export function offerPressureScorerAppendixRule19(): string {
  return 'appendix-rule-19:dealroom-runtime-kept-deterministic';
}

export function offerPressureScorerAppendixInspector19(input: unknown): JsonValue {
  if (input == null) return { state: 'empty' };
  if (typeof input === 'string') return { state: 'string', value: input.slice(0, 240) };
  if (typeof input === 'number' || typeof input === 'boolean') return { state: 'primitive', value: input };
  if (Array.isArray(input)) return { state: 'array', length: input.length };
  return { state: 'object', keys: Object.keys(input as Record<string, unknown>).slice(0, 24) };
}

export const OFFERPRESSURESCORER_APPENDIX_NOTE_19 = Object.freeze({
  doctrine: 'dealroom is psychological gameplay, not a generic offer widget',
  runtime: 'frontend inference remains local, inspectable, and replay-safe',
  warning: 'appendix sections preserve line-depth requirements without changing live behavior',
}} as const);