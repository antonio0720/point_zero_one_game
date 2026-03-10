/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/CardOverlayResolver.ts
 *
 * Doctrine:
 * - the same base card mutates by mode at draw time
 * - legality is backend-owned
 * - tags drive routing and scoring across modes
 * - timing classes are validated against runtime windows, not UI assumptions
 */

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  DivergencePotential,
  EffectPayload,
  ModeCode,
  ModeOverlay,
  PressureTier,
  Targeting,
  TimingClass,
} from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import { createDeterministicId } from './Deterministic';

export type ResourceType =
  | 'cash'
  | 'battle_budget'
  | 'shared_treasury'
  | 'free';

export interface ResolvedCardView {
  definitionId: string;
  mode: ModeCode;
  legal: boolean;
  legalityReasons: string[];
  resourceType: ResourceType;
  cost: number;
  effect: EffectPayload;
  targeting: Targeting;
  timingClass: TimingClass[];
  timingLocks: TimingClass[];
  tags: string[];
  tagWeights: Record<string, number>;
  autoResolve: boolean;
  decisionTimerMs: number | null;
  decayTicksRemaining: number | null;
  divergencePotential: DivergencePotential;
}

export interface ValidateCardPlayInput {
  snapshot: RunStateSnapshot;
  card: CardDefinition | CardInstance;
  requestedTimingClass?: TimingClass;
  availableTimingClasses?: readonly TimingClass[];
  actorId?: string;
}

export interface CardPlayValidationResult {
  legal: boolean;
  chosenTimingClass: TimingClass | null;
  reasons: string[];
  resolved: ResolvedCardView;
}

const MODE_TAG_WEIGHTS: Record<ModeCode, Record<string, number>> = {
  solo: {
    liquidity: 2.0,
    income: 2.2,
    resilience: 1.8,
    scale: 2.5,
    tempo: 1.0,
    sabotage: 0.0,
    counter: 0.0,
    heat: 0.6,
    trust: 0.0,
    aid: 0.0,
    precision: 1.2,
    divergence: 0.0,
    variance: 1.0,
    cascade: 1.8,
    momentum: 2.0,
  },
  pvp: {
    liquidity: 0.8,
    income: 0.6,
    resilience: 1.0,
    scale: 0.5,
    tempo: 2.4,
    sabotage: 2.8,
    counter: 2.2,
    heat: 1.5,
    trust: 0.0,
    aid: 0.0,
    precision: 0.8,
    divergence: 0.0,
    variance: 1.4,
    cascade: 1.2,
    momentum: 1.5,
  },
  coop: {
    liquidity: 1.5,
    income: 1.8,
    resilience: 2.0,
    scale: 1.3,
    tempo: 1.0,
    sabotage: 0.2,
    counter: 0.5,
    heat: 0.8,
    trust: 3.0,
    aid: 2.5,
    precision: 1.0,
    divergence: 0.0,
    variance: 0.4,
    cascade: 1.6,
    momentum: 1.2,
  },
  ghost: {
    liquidity: 1.2,
    income: 1.0,
    resilience: 1.4,
    scale: 0.9,
    tempo: 1.8,
    sabotage: 0.0,
    counter: 0.0,
    heat: 1.0,
    trust: 0.0,
    aid: 0.0,
    precision: 2.6,
    divergence: 3.0,
    variance: 0.3,
    cascade: 1.5,
    momentum: 1.0,
  },
};

const DECK_MODE_LEGALITY: Record<DeckType, ModeCode[]> = {
  OPPORTUNITY: ['solo', 'pvp', 'coop', 'ghost'],
  IPA: ['solo', 'pvp', 'coop', 'ghost'],
  FUBAR: ['solo', 'pvp', 'coop', 'ghost'],
  MISSED_OPPORTUNITY: ['solo', 'pvp', 'coop', 'ghost'],
  PRIVILEGED: ['solo', 'pvp', 'coop', 'ghost'],
  SO: ['solo', 'pvp', 'coop', 'ghost'],
  SABOTAGE: ['pvp'],
  COUNTER: ['pvp'],
  AID: ['coop'],
  RESCUE: ['coop'],
  DISCIPLINE: ['solo', 'ghost'],
  TRUST: ['coop'],
  BLUFF: ['pvp'],
  GHOST: ['ghost'],
};

const PRESSURE_COST_MULTIPLIER: Record<PressureTier, number> = {
  T0: 0.95,
  T1: 1.0,
  T2: 1.06,
  T3: 1.14,
  T4: 1.25,
};

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function uniqueTimingClasses(values: readonly TimingClass[]): TimingClass[] {
  return Array.from(new Set(values));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function copyEffect(effect: EffectPayload): EffectPayload {
  return {
    cashDelta: effect.cashDelta,
    incomeDelta: effect.incomeDelta,
    shieldDelta: effect.shieldDelta,
    heatDelta: effect.heatDelta,
    trustDelta: effect.trustDelta,
    timeDeltaMs: effect.timeDeltaMs,
    divergenceDelta: effect.divergenceDelta,
    cascadeTag: effect.cascadeTag ?? null,
    injectCards: effect.injectCards ? [...effect.injectCards] : undefined,
  };
}

function multiplyEffect(
  effect: EffectPayload,
  multiplier: number,
): EffectPayload {
  const next = copyEffect(effect);

  if (typeof next.cashDelta === 'number') {
    next.cashDelta = roundCurrency(next.cashDelta * multiplier);
  }

  if (typeof next.incomeDelta === 'number') {
    next.incomeDelta = roundCurrency(next.incomeDelta * multiplier);
  }

  if (typeof next.shieldDelta === 'number') {
    next.shieldDelta = roundCurrency(next.shieldDelta * multiplier);
  }

  if (typeof next.heatDelta === 'number') {
    next.heatDelta = roundCurrency(next.heatDelta * multiplier);
  }

  if (typeof next.trustDelta === 'number') {
    next.trustDelta = roundCurrency(next.trustDelta * multiplier);
  }

  if (typeof next.timeDeltaMs === 'number') {
    next.timeDeltaMs = Math.trunc(next.timeDeltaMs * multiplier);
  }

  if (typeof next.divergenceDelta === 'number') {
    next.divergenceDelta = roundCurrency(next.divergenceDelta * multiplier);
  }

  return next;
}

function getModeOverlay(
  definition: CardDefinition,
  mode: ModeCode,
): Partial<ModeOverlay> | null {
  return definition.modeOverlay?.[mode] ?? null;
}

function isNearGhostMarker(snapshot: RunStateSnapshot): boolean {
  return snapshot.cards.ghostMarkers.some(
    (marker) => Math.abs(marker.tick - snapshot.tick) <= 3,
  );
}

function phaseBoundaryWindowOpen(snapshot: RunStateSnapshot): boolean {
  return snapshot.mode === 'solo' && snapshot.modeState.phaseBoundaryWindowsRemaining > 0;
}

function deriveResourceType(
  definition: CardDefinition,
  mode: ModeCode,
): ResourceType {
  if (definition.baseCost <= 0) {
    return 'free';
  }

  if (
    mode === 'pvp' &&
    (definition.deckType === 'SABOTAGE' ||
      definition.deckType === 'COUNTER')
  ) {
    return 'battle_budget';
  }

  if (
    mode === 'coop' &&
    (definition.deckType === 'AID' ||
      definition.deckType === 'RESCUE' ||
      definition.deckType === 'TRUST')
  ) {
    return 'shared_treasury';
  }

  return 'cash';
}

function deriveTargeting(
  definition: CardDefinition,
  mode: ModeCode,
  overlay: Partial<ModeOverlay> | null,
): Targeting {
  if (overlay?.targetingOverride) {
    return overlay.targetingOverride;
  }

  if (mode === 'solo') {
    return 'SELF';
  }

  if (mode === 'pvp') {
    if (
      definition.deckType === 'SABOTAGE' ||
      definition.deckType === 'BLUFF'
    ) {
      return 'OPPONENT';
    }

    if (definition.deckType === 'COUNTER') {
      return 'SELF';
    }
  }

  if (mode === 'coop') {
    if (definition.deckType === 'AID') {
      return 'TEAMMATE';
    }

    if (
      definition.deckType === 'RESCUE' ||
      definition.deckType === 'TRUST'
    ) {
      return 'TEAM';
    }
  }

  if (mode === 'ghost') {
    return 'SELF';
  }

  return definition.targeting;
}

function deriveDivergencePotential(
  definition: CardDefinition,
  snapshot: RunStateSnapshot,
  overlay: Partial<ModeOverlay> | null,
): DivergencePotential {
  if (overlay?.divergencePotential) {
    return overlay.divergencePotential;
  }

  if (snapshot.mode !== 'ghost') {
    return 'LOW';
  }

  if (
    definition.deckType === 'GHOST' ||
    definition.tags.includes('divergence')
  ) {
    return isNearGhostMarker(snapshot) ? 'HIGH' : 'MEDIUM';
  }

  if (definition.tags.includes('precision')) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function deriveTimingLocks(
  overlay: Partial<ModeOverlay> | null,
): TimingClass[] {
  return overlay?.timingLock ? uniqueTimingClasses(overlay.timingLock) : [];
}

function computeTrustModifier(snapshot: RunStateSnapshot): number {
  if (snapshot.mode !== 'coop') {
    return 1;
  }

  const scores = Object.values(snapshot.modeState.trustScores);
  if (scores.length === 0) {
    return 1;
  }

  const average =
    scores.reduce((sum, score) => sum + Number(score || 0), 0) / scores.length;

  if (average >= 90) {
    return 1.25;
  }

  if (average >= 75) {
    return 1.12;
  }

  if (average >= 50) {
    return 1.0;
  }

  if (average >= 25) {
    return 0.9;
  }

  return 0.8;
}

function computeModeEffectModifier(
  definition: CardDefinition,
  snapshot: RunStateSnapshot,
): number {
  let modifier = 1;

  if (snapshot.mode === 'ghost' && isNearGhostMarker(snapshot)) {
    if (
      definition.tags.includes('precision') ||
      definition.tags.includes('divergence') ||
      definition.deckType === 'GHOST'
    ) {
      modifier += 0.2;
    }
  }

  if (snapshot.mode === 'pvp') {
    if (
      definition.deckType === 'SABOTAGE' &&
      snapshot.pressure.tier === 'T4'
    ) {
      modifier += 0.15;
    }

    if (definition.deckType === 'COUNTER') {
      modifier += 0.08;
    }
  }

  if (snapshot.mode === 'coop') {
    if (
      definition.deckType === 'AID' ||
      definition.deckType === 'RESCUE' ||
      definition.deckType === 'TRUST'
    ) {
      modifier *= computeTrustModifier(snapshot);
    }
  }

  if (snapshot.mode === 'solo') {
    if (
      definition.deckType === 'DISCIPLINE' &&
      snapshot.pressure.tier === 'T3'
    ) {
      modifier += 0.1;
    }

    if (
      definition.tags.includes('income') &&
      snapshot.phase === 'FOUNDATION'
    ) {
      modifier += 0.05;
    }
  }

  return modifier;
}

function defaultDecisionTimerMs(
  definition: CardDefinition,
  snapshot: RunStateSnapshot,
  resolvedTimingClass: readonly TimingClass[],
): number | null {
  if (definition.decisionTimerOverrideMs !== null) {
    return definition.decisionTimerOverrideMs;
  }

  if (definition.autoResolve) {
    return null;
  }

  if (resolvedTimingClass.includes('CTR')) {
    return 5_000;
  }

  if (resolvedTimingClass.includes('FATE')) {
    return 4_000;
  }

  if (resolvedTimingClass.includes('PHZ')) {
    return snapshot.timers.currentTickDurationMs * 5;
  }

  if (resolvedTimingClass.includes('GBM')) {
    return snapshot.timers.currentTickDurationMs * 3;
  }

  let timer = snapshot.timers.currentTickDurationMs;

  const totalShield = snapshot.shield.layers.reduce(
    (sum, layer) => sum + layer.current,
    0,
  );

  if (snapshot.mode === 'solo' && snapshot.pressure.tier === 'T4') {
    timer = Math.round(timer * 0.85);
  }

  if (snapshot.mode === 'solo' && totalShield <= 0 && snapshot.pressure.tier >= 'T3') {
    timer = Math.round(timer * 0.75);
  }

  return timer;
}

function defaultDecayTicks(definition: CardDefinition, snapshot: RunStateSnapshot): number | null {
  if (definition.decayTicks !== null) {
    return definition.decayTicks;
  }

  if (snapshot.mode === 'ghost' && definition.deckType === 'GHOST') {
    return 3;
  }

  if (snapshot.mode === 'pvp' && definition.deckType === 'COUNTER') {
    return 2;
  }

  return null;
}

function determineDynamicLegality(
  definition: CardDefinition,
  snapshot: RunStateSnapshot,
): string[] {
  const reasons: string[] = [];

  if (!definition.modeLegal.includes(snapshot.mode)) {
    reasons.push(`Card ${definition.id} is not legal in mode ${snapshot.mode}.`);
  }

  const deckModes = DECK_MODE_LEGALITY[definition.deckType] ?? [];
  if (!deckModes.includes(snapshot.mode)) {
    reasons.push(
      `Deck type ${definition.deckType} is not permitted in mode ${snapshot.mode}.`,
    );
  }

  if (
    snapshot.mode === 'ghost' &&
    definition.deckType === 'GHOST' &&
    !snapshot.modeState.legendMarkersEnabled
  ) {
    reasons.push('Ghost cards require legend markers to be enabled.');
  }

  if (
    snapshot.mode === 'solo' &&
    definition.timingClass.includes('PHZ') &&
    !phaseBoundaryWindowOpen(snapshot)
  ) {
    reasons.push('Phase Boundary cards require an active phase boundary window.');
  }

  if (
    snapshot.mode !== 'pvp' &&
    (definition.timingClass.includes('CTR') ||
      definition.deckType === 'COUNTER' ||
      definition.deckType === 'SABOTAGE' ||
      definition.deckType === 'BLUFF')
  ) {
    reasons.push('Predator combat cards are legal only in PvP mode.');
  }

  if (
    snapshot.mode !== 'coop' &&
    (definition.timingClass.includes('AID') ||
      definition.timingClass.includes('RES') ||
      definition.deckType === 'AID' ||
      definition.deckType === 'RESCUE' ||
      definition.deckType === 'TRUST')
  ) {
    reasons.push('Aid, Rescue, and Trust cards are legal only in co-op mode.');
  }

  if (
    snapshot.mode !== 'ghost' &&
    (definition.timingClass.includes('GBM') ||
      definition.deckType === 'GHOST')
  ) {
    reasons.push('Ghost Benchmark cards are legal only in Phantom mode.');
  }

  return reasons;
}

function selectedTimingClass(
  resolvedTimingClass: readonly TimingClass[],
  requestedTimingClass: TimingClass | undefined,
  availableTimingClasses: readonly TimingClass[],
): TimingClass | null {
  if (requestedTimingClass) {
    return requestedTimingClass;
  }

  const exact = resolvedTimingClass.find((timingClass) =>
    availableTimingClasses.includes(timingClass),
  );

  if (exact) {
    return exact;
  }

  if (resolvedTimingClass.includes('ANY')) {
    return availableTimingClasses[0] ?? 'ANY';
  }

  return null;
}

export class CardOverlayResolver {
  public resolveDefinition(
    definition: CardDefinition,
    snapshot: RunStateSnapshot,
  ): ResolvedCardView {
    const overlay = getModeOverlay(definition, snapshot.mode);
    const legalityReasons = determineDynamicLegality(definition, snapshot);

    if (overlay?.legal === false) {
      legalityReasons.push(
        `Mode overlay explicitly marks ${definition.id} illegal in ${snapshot.mode}.`,
      );
    }

    const pressureMultiplier = PRESSURE_COST_MULTIPLIER[snapshot.pressure.tier];
    const overlayCostModifier = overlay?.costModifier ?? 1;
    const resolvedCost = roundCurrency(
      definition.baseCost * overlayCostModifier * pressureMultiplier,
    );

    const effectModifier =
      (overlay?.effectModifier ?? 1) *
      computeModeEffectModifier(definition, snapshot);

    const resolvedEffect = multiplyEffect(definition.baseEffect, effectModifier);
    const resourceType = deriveResourceType(definition, snapshot.mode);
    const targeting = deriveTargeting(definition, snapshot.mode, overlay);

    const timingLocks = deriveTimingLocks(overlay);
    const resolvedTimingClass = uniqueTimingClasses([
      ...definition.timingClass,
      ...timingLocks,
    ]);

    const tagWeights = this.computeTagWeights(definition, snapshot, overlay);
    const tags = uniqueStrings(definition.tags);
    const autoResolve =
      definition.autoResolve ||
      (definition.deckType === 'FUBAR' && snapshot.mode !== 'pvp');

    return {
      definitionId: definition.id,
      mode: snapshot.mode,
      legal: legalityReasons.length === 0,
      legalityReasons,
      resourceType,
      cost: resolvedCost,
      effect: resolvedEffect,
      targeting,
      timingClass: resolvedTimingClass,
      timingLocks,
      tags,
      tagWeights,
      autoResolve,
      decisionTimerMs: defaultDecisionTimerMs(
        definition,
        snapshot,
        resolvedTimingClass,
      ),
      decayTicksRemaining: defaultDecayTicks(definition, snapshot),
      divergencePotential: deriveDivergencePotential(definition, snapshot, overlay),
    };
  }

  public resolveInstanceForPlay(
    instance: CardInstance,
    snapshot: RunStateSnapshot,
  ): ResolvedCardView {
    const base = this.resolveDefinition(instance.card, snapshot);

    return {
      ...base,
      cost: instance.cost,
      targeting: instance.targeting,
      timingClass: uniqueTimingClasses(instance.timingClass),
      tags: uniqueStrings(instance.tags),
      decayTicksRemaining: instance.decayTicksRemaining,
      divergencePotential: instance.divergencePotential,
    };
  }

  public createInstance(
    definition: CardDefinition,
    snapshot: RunStateSnapshot,
  ): CardInstance | null {
    const resolved = this.resolveDefinition(definition, snapshot);

    if (!resolved.legal) {
      return null;
    }

    const instanceId = createDeterministicId(
      'card-instance',
      snapshot.seed,
      snapshot.runId,
      snapshot.tick,
      definition.id,
      snapshot.cards.hand.length,
      snapshot.cards.drawHistory.length,
    );

    return {
      instanceId,
      definitionId: definition.id,
      card: definition,
      cost: resolved.cost,
      targeting: resolved.targeting,
      timingClass: resolved.timingClass,
      tags: resolved.tags,
      overlayAppliedForMode: snapshot.mode,
      decayTicksRemaining: resolved.decayTicksRemaining,
      divergencePotential: resolved.divergencePotential,
    };
  }

  public validateCardPlay(
    input: ValidateCardPlayInput,
  ): CardPlayValidationResult {
    const resolved =
      'instanceId' in input.card
        ? this.resolveInstanceForPlay(input.card, input.snapshot)
        : this.resolveDefinition(input.card, input.snapshot);

    const reasons = [...resolved.legalityReasons];
    const availableTimingClasses = Array.from(
      new Set(input.availableTimingClasses ?? ['ANY']),
    ) as TimingClass[];

    const chosen = selectedTimingClass(
      resolved.timingClass,
      input.requestedTimingClass,
      availableTimingClasses,
    );

    if (!resolved.legal) {
      return {
        legal: false,
        chosenTimingClass: chosen,
        reasons,
        resolved,
      };
    }

    if (chosen === null) {
      reasons.push(
        `No valid timing class open for card ${resolved.definitionId}. Available: ${availableTimingClasses.join(', ')}`,
      );

      return {
        legal: false,
        chosenTimingClass: null,
        reasons,
        resolved,
      };
    }

    if (
      !resolved.timingClass.includes('ANY') &&
      !resolved.timingClass.includes(chosen)
    ) {
      reasons.push(
        `Requested timing class ${chosen} is not legal for ${resolved.definitionId}.`,
      );
    }

    if (
      input.requestedTimingClass &&
      !availableTimingClasses.includes(input.requestedTimingClass)
    ) {
      reasons.push(
        `Requested timing class ${input.requestedTimingClass} is not currently open.`,
      );
    }

    if (resolved.timingLocks.length > 0) {
      const lockSatisfied = resolved.timingLocks.some((timingClass) =>
        availableTimingClasses.includes(timingClass),
      );

      if (!lockSatisfied) {
        reasons.push(
          `Card ${resolved.definitionId} requires one of the locked timing windows: ${resolved.timingLocks.join(', ')}`,
        );
      }
    }

    if (!this.hasSufficientResources(input.snapshot, resolved)) {
      const currentBalance = this.getResourceBalance(input.snapshot, resolved.resourceType);
      reasons.push(
        `Insufficient ${resolved.resourceType}. Need ${resolved.cost}, have ${currentBalance}.`,
      );
    }

    if (
      chosen === 'GBM' &&
      !isNearGhostMarker(input.snapshot)
    ) {
      reasons.push('GBM card played without a nearby legend marker.');
    }

    if (
      chosen === 'PHZ' &&
      !phaseBoundaryWindowOpen(input.snapshot)
    ) {
      reasons.push('PHZ card played without an active phase boundary window.');
    }

    if (
      chosen === 'CTR' &&
      input.snapshot.mode !== 'pvp'
    ) {
      reasons.push('Counter Window exists only in PvP mode.');
    }

    if (
      (chosen === 'RES' || chosen === 'AID') &&
      input.snapshot.mode !== 'coop'
    ) {
      reasons.push(`${chosen} timing exists only in co-op mode.`);
    }

    return {
      legal: reasons.length === 0,
      chosenTimingClass: chosen,
      reasons,
      resolved,
    };
  }

  public computeTagWeights(
    definition: CardDefinition,
    snapshot: RunStateSnapshot,
    overlay?: Partial<ModeOverlay> | null,
  ): Record<string, number> {
    const baseWeights = {
      ...MODE_TAG_WEIGHTS[snapshot.mode],
    };

    for (const tag of definition.tags) {
      if (baseWeights[tag] === undefined) {
        baseWeights[tag] = 1;
      }
    }

    if (overlay?.tagWeights) {
      for (const [tag, weight] of Object.entries(overlay.tagWeights)) {
        baseWeights[tag] = weight;
      }
    }

    return baseWeights;
  }

  public hasSufficientResources(
    snapshot: RunStateSnapshot,
    resolved: ResolvedCardView,
  ): boolean {
    if (resolved.resourceType === 'free') {
      return true;
    }

    return this.getResourceBalance(snapshot, resolved.resourceType) >= resolved.cost;
  }

  public getResourceBalance(
    snapshot: RunStateSnapshot,
    resourceType: ResourceType,
  ): number {
    switch (resourceType) {
      case 'cash':
        return snapshot.economy.cash;
      case 'battle_budget':
        return snapshot.battle.battleBudget;
      case 'shared_treasury':
        return snapshot.modeState.sharedTreasuryBalance;
      case 'free':
        return Number.POSITIVE_INFINITY;
      default:
        return 0;
    }
  }
}