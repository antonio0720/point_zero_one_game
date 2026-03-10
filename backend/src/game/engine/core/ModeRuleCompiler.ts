/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/ModeRuleCompiler.ts
 *
 * Doctrine:
 * - mode truth is compiled server-side from one canonical ruleset
 * - compilation is deterministic, immutable, and safe to cache
 * - compiled rules should be directly consumable by timing, routing, and proof
 * - card legality must reflect both static mode doctrine and runtime state
 * - this file does not replace backend mode adapters; it feeds them
 */

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  HaterBotId,
  IntegrityStatus,
  ModeCode,
  ModeOverlay,
  Targeting,
  TimingClass,
  VisibilityLevel,
} from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';

export type ModeLabel = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export interface ModeCompilationOverrides {
  readonly pressureCurveModifier?: number;
  readonly heatCurveModifier?: number;
  readonly holdEnabled?: boolean;
  readonly loadoutEnabled?: boolean;
  readonly sharedTreasury?: boolean;
  readonly sharedOpportunityDeck?: boolean;
  readonly legendMarkersEnabled?: boolean;
  readonly allowAid?: boolean;
  readonly allowDefection?: boolean;
  readonly allowDirectAttacks?: boolean;
  readonly extraDisabledBots?: readonly HaterBotId[];
  readonly spectatorLimit?: number;
  readonly communityHeatModifier?: number;
  readonly gradeBias?: number;
  readonly sharedTreasuryBalance?: number;
  readonly phaseBoundaryWindowsRemaining?: number;
  readonly counterIntelTier?: number;
}

export interface ModeTimingPolicy {
  readonly allowedTimingClasses: readonly TimingClass[];
  readonly priorityTimingClasses: readonly TimingClass[];
  readonly phaseBoundaryWindowsRemaining: number;
  readonly freezeWindowsAllowed: boolean;
  readonly extraDecisionMs: number;
}

export interface ModeEconomyPolicy {
  readonly sharedTreasuryBalance: number;
  readonly sharedTreasury: boolean;
  readonly sharedOpportunityDeck: boolean;
  readonly allowAid: boolean;
  readonly allowDefection: boolean;
  readonly aidTrustBonus: number;
  readonly privilegeEffectMultiplier: number;
  readonly defectionPenalty: number;
}

export interface ModeThreatPolicy {
  readonly counterIntelTier: number;
  readonly threatVisibilityFloor: VisibilityLevel;
  readonly threatVisibilityCeiling: VisibilityLevel;
  readonly disabledBots: readonly HaterBotId[];
  readonly spectatorLimit: number;
  readonly rivalryHeatMultiplier: number;
}

export interface ModeProofPolicy {
  readonly integrityFloor: IntegrityStatus;
  readonly gradeBias: number;
  readonly badgeHints: readonly string[];
  readonly legendGapBias: number;
}

export interface CompiledModeRules {
  readonly mode: ModeCode;
  readonly label: ModeLabel;
  readonly allowedDecks: readonly DeckType[];
  readonly blockedDecks: readonly DeckType[];
  readonly allowedTargetings: readonly Targeting[];
  readonly holdEnabled: boolean;
  readonly loadoutEnabled: boolean;
  readonly sharedTreasury: boolean;
  readonly legendMarkersEnabled: boolean;
  readonly sharedOpportunityDeck: boolean;
  readonly allowAid: boolean;
  readonly allowDefection: boolean;
  readonly allowDirectAttacks: boolean;
  readonly pressureCurveModifier: number;
  readonly heatCurveModifier: number;
  readonly timingPolicy: ModeTimingPolicy;
  readonly economyPolicy: ModeEconomyPolicy;
  readonly threatPolicy: ModeThreatPolicy;
  readonly proofPolicy: ModeProofPolicy;
}

export interface CompiledCardProjection {
  readonly cardId: string;
  readonly deckType: DeckType;
  readonly effectiveCost: number;
  readonly effectMultiplier: number;
  readonly targeting: Targeting;
  readonly allowedTimingClasses: readonly TimingClass[];
  readonly allowedTargetings: readonly Targeting[];
  readonly legalInMode: boolean;
  readonly reasons: readonly string[];
}

export interface ModeCardLegalityResult {
  readonly ok: boolean;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly projection: CompiledCardProjection;
}

interface ModeSeed {
  readonly label: ModeLabel;
  readonly allowedDecks: readonly DeckType[];
  readonly defaultBlockedDecks: readonly DeckType[];
  readonly allowedTargetings: readonly Targeting[];
  readonly allowedTimingClasses: readonly TimingClass[];
  readonly priorityTimingClasses: readonly TimingClass[];
  readonly holdEnabled: boolean;
  readonly loadoutEnabled: boolean;
  readonly sharedTreasury: boolean;
  readonly sharedOpportunityDeck: boolean;
  readonly legendMarkersEnabled: boolean;
  readonly allowAid: boolean;
  readonly allowDefection: boolean;
  readonly allowDirectAttacks: boolean;
  readonly defaultSpectatorLimit: number;
  readonly threatVisibilityFloor: VisibilityLevel;
  readonly threatVisibilityCeiling: VisibilityLevel;
  readonly basePressureCurveModifier: number;
  readonly baseHeatCurveModifier: number;
  readonly baseExtraDecisionMs: number;
  readonly baseGradeBias: number;
  readonly baseBadgeHints: readonly string[];
  readonly disabledBots: readonly HaterBotId[];
}

const PRESSURE_TIER_MULTIPLIER: Record<
  RunStateSnapshot['pressure']['tier'],
  number
> = {
  T0: 0.90,
  T1: 1.00,
  T2: 1.12,
  T3: 1.25,
  T4: 1.40,
};

const VISIBILITY_ORDER: Record<VisibilityLevel, number> = {
  HIDDEN: 0,
  SILHOUETTE: 1,
  PARTIAL: 2,
  EXPOSED: 3,
};

const VISIBILITY_BY_ORDER: Record<number, VisibilityLevel> = {
  0: 'HIDDEN',
  1: 'SILHOUETTE',
  2: 'PARTIAL',
  3: 'EXPOSED',
};

const MODE_SEEDS: Record<ModeCode, ModeSeed> = {
  solo: {
    label: 'EMPIRE',
    allowedDecks: [
      'OPPORTUNITY',
      'IPA',
      'FUBAR',
      'MISSED_OPPORTUNITY',
      'PRIVILEGED',
      'SO',
      'COUNTER',
      'DISCIPLINE',
    ],
    defaultBlockedDecks: ['AID', 'RESCUE', 'TRUST', 'BLUFF', 'GHOST', 'SABOTAGE'],
    allowedTargetings: ['SELF', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'CTR', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['PRE', 'RES', 'END'],
    holdEnabled: true,
    loadoutEnabled: true,
    sharedTreasury: false,
    sharedOpportunityDeck: false,
    legendMarkersEnabled: false,
    allowAid: false,
    allowDefection: false,
    allowDirectAttacks: false,
    defaultSpectatorLimit: 0,
    threatVisibilityFloor: 'PARTIAL',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 1.00,
    baseHeatCurveModifier: 1.00,
    baseExtraDecisionMs: 1000,
    baseGradeBias: 0.00,
    baseBadgeHints: ['EMPIRE_DISCIPLINE', 'SOLO_EXECUTION'],
    disabledBots: [],
  },
  pvp: {
    label: 'PREDATOR',
    allowedDecks: [
      'OPPORTUNITY',
      'PRIVILEGED',
      'SABOTAGE',
      'COUNTER',
      'BLUFF',
      'SO',
      'DISCIPLINE',
      'MISSED_OPPORTUNITY',
    ],
    defaultBlockedDecks: ['AID', 'RESCUE', 'TRUST', 'GHOST'],
    allowedTargetings: ['SELF', 'OPPONENT', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'CTR', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['CTR', 'PHZ', 'POST'],
    holdEnabled: false,
    loadoutEnabled: false,
    sharedTreasury: false,
    sharedOpportunityDeck: true,
    legendMarkersEnabled: false,
    allowAid: false,
    allowDefection: false,
    allowDirectAttacks: true,
    defaultSpectatorLimit: 50,
    threatVisibilityFloor: 'SILHOUETTE',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 1.12,
    baseHeatCurveModifier: 1.18,
    baseExtraDecisionMs: 250,
    baseGradeBias: 0.03,
    baseBadgeHints: ['PREDATOR_DOMINANCE', 'COUNTERPLAY_READY'],
    disabledBots: [],
  },
  coop: {
    label: 'SYNDICATE',
    allowedDecks: [
      'OPPORTUNITY',
      'AID',
      'RESCUE',
      'TRUST',
      'COUNTER',
      'SO',
      'DISCIPLINE',
    ],
    defaultBlockedDecks: ['BLUFF', 'GHOST'],
    allowedTargetings: ['SELF', 'TEAMMATE', 'TEAM', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'AID', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['AID', 'RES', 'PHZ'],
    holdEnabled: false,
    loadoutEnabled: false,
    sharedTreasury: true,
    sharedOpportunityDeck: false,
    legendMarkersEnabled: false,
    allowAid: true,
    allowDefection: true,
    allowDirectAttacks: false,
    defaultSpectatorLimit: 10,
    threatVisibilityFloor: 'PARTIAL',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 0.95,
    baseHeatCurveModifier: 1.05,
    baseExtraDecisionMs: 1250,
    baseGradeBias: 0.05,
    baseBadgeHints: ['SYNDICATE_SOLIDARITY', 'TRUST_ENGINE'],
    disabledBots: [],
  },
  ghost: {
    label: 'PHANTOM',
    allowedDecks: [
      'OPPORTUNITY',
      'GHOST',
      'COUNTER',
      'SO',
      'DISCIPLINE',
      'MISSED_OPPORTUNITY',
    ],
    defaultBlockedDecks: ['AID', 'RESCUE', 'TRUST', 'BLUFF', 'SABOTAGE'],
    allowedTargetings: ['SELF', 'GLOBAL'],
    allowedTimingClasses: ['PRE', 'POST', 'GBM', 'RES', 'PHZ', 'END', 'ANY'],
    priorityTimingClasses: ['GBM', 'PHZ', 'END'],
    holdEnabled: false,
    loadoutEnabled: false,
    sharedTreasury: false,
    sharedOpportunityDeck: false,
    legendMarkersEnabled: true,
    allowAid: false,
    allowDefection: false,
    allowDirectAttacks: false,
    defaultSpectatorLimit: 0,
    threatVisibilityFloor: 'PARTIAL',
    threatVisibilityCeiling: 'EXPOSED',
    basePressureCurveModifier: 1.08,
    baseHeatCurveModifier: 1.10,
    baseExtraDecisionMs: 500,
    baseGradeBias: 0.04,
    baseBadgeHints: ['PHANTOM_PARITY', 'LEGEND_PURSUIT'],
    disabledBots: [],
  },
};

export class ModeRuleCompiler {
  public compile(
    mode: ModeCode,
    overrides: ModeCompilationOverrides = {},
  ): CompiledModeRules {
    const seed = MODE_SEEDS[mode];
    const disabledBots = this.unique(seed.disabledBots, overrides.extraDisabledBots ?? []);
    const blockedDecks = this.unique(
      seed.defaultBlockedDecks,
      this.computeDerivedBlockedDecks(mode),
    );
    const counterIntelTier = Math.max(1, overrides.counterIntelTier ?? 1);
    const communityHeatModifier = overrides.communityHeatModifier ?? 0;

    return {
      mode,
      label: seed.label,
      allowedDecks: [...seed.allowedDecks],
      blockedDecks,
      allowedTargetings: [...seed.allowedTargetings],
      holdEnabled: overrides.holdEnabled ?? seed.holdEnabled,
      loadoutEnabled: overrides.loadoutEnabled ?? seed.loadoutEnabled,
      sharedTreasury: overrides.sharedTreasury ?? seed.sharedTreasury,
      legendMarkersEnabled:
        overrides.legendMarkersEnabled ?? seed.legendMarkersEnabled,
      sharedOpportunityDeck:
        overrides.sharedOpportunityDeck ?? seed.sharedOpportunityDeck,
      allowAid: overrides.allowAid ?? seed.allowAid,
      allowDefection: overrides.allowDefection ?? seed.allowDefection,
      allowDirectAttacks:
        overrides.allowDirectAttacks ?? seed.allowDirectAttacks,
      pressureCurveModifier: this.round(
        seed.basePressureCurveModifier *
          (overrides.pressureCurveModifier ?? 1),
      ),
      heatCurveModifier: this.round(
        seed.baseHeatCurveModifier *
          (overrides.heatCurveModifier ?? 1) *
          (1 + communityHeatModifier / 100),
      ),
      timingPolicy: {
        allowedTimingClasses: [...seed.allowedTimingClasses],
        priorityTimingClasses: [...seed.priorityTimingClasses],
        phaseBoundaryWindowsRemaining:
          overrides.phaseBoundaryWindowsRemaining ?? 0,
        freezeWindowsAllowed:
          (overrides.holdEnabled ?? seed.holdEnabled) ||
          mode === 'ghost',
        extraDecisionMs: seed.baseExtraDecisionMs,
      },
      economyPolicy: {
        sharedTreasuryBalance: overrides.sharedTreasuryBalance ?? 0,
        sharedTreasury: overrides.sharedTreasury ?? seed.sharedTreasury,
        sharedOpportunityDeck:
          overrides.sharedOpportunityDeck ?? seed.sharedOpportunityDeck,
        allowAid: overrides.allowAid ?? seed.allowAid,
        allowDefection: overrides.allowDefection ?? seed.allowDefection,
        aidTrustBonus: mode === 'coop' ? 0.20 : 0.00,
        privilegeEffectMultiplier:
          mode === 'pvp' ? 1.10 : mode === 'solo' ? 1.05 : 1.00,
        defectionPenalty: mode === 'coop' ? 0.30 : 0.00,
      },
      threatPolicy: {
        counterIntelTier,
        threatVisibilityFloor: seed.threatVisibilityFloor,
        threatVisibilityCeiling: seed.threatVisibilityCeiling,
        disabledBots,
        spectatorLimit:
          overrides.spectatorLimit ?? seed.defaultSpectatorLimit,
        rivalryHeatMultiplier: mode === 'pvp' ? 1.25 : 0.50,
      },
      proofPolicy: {
        integrityFloor: 'UNVERIFIED',
        gradeBias: this.round(seed.baseGradeBias + (overrides.gradeBias ?? 0)),
        badgeHints: [...seed.baseBadgeHints],
        legendGapBias: mode === 'ghost' ? 1.00 : 0.00,
      },
    };
  }

  public compileSnapshot(
    snapshot: RunStateSnapshot,
    overrides: ModeCompilationOverrides = {},
  ): CompiledModeRules {
    const tierScalar = PRESSURE_TIER_MULTIPLIER[snapshot.pressure.tier];

    const compiled = this.compile(snapshot.mode, {
      ...overrides,
      pressureCurveModifier:
        (overrides.pressureCurveModifier ?? 1) * tierScalar,
      heatCurveModifier:
        (overrides.heatCurveModifier ?? 1) *
        tierScalar *
        (1 + snapshot.modeState.communityHeatModifier / 100),
      holdEnabled: overrides.holdEnabled ?? snapshot.modeState.holdEnabled,
      loadoutEnabled:
        overrides.loadoutEnabled ?? snapshot.modeState.loadoutEnabled,
      sharedTreasury:
        overrides.sharedTreasury ?? snapshot.modeState.sharedTreasury,
      sharedOpportunityDeck:
        overrides.sharedOpportunityDeck ??
        snapshot.modeState.sharedOpportunityDeck,
      legendMarkersEnabled:
        overrides.legendMarkersEnabled ??
        snapshot.modeState.legendMarkersEnabled,
      communityHeatModifier:
        overrides.communityHeatModifier ??
        snapshot.modeState.communityHeatModifier,
      sharedTreasuryBalance:
        overrides.sharedTreasuryBalance ??
        snapshot.modeState.sharedTreasuryBalance,
      phaseBoundaryWindowsRemaining:
        overrides.phaseBoundaryWindowsRemaining ??
        snapshot.modeState.phaseBoundaryWindowsRemaining,
      counterIntelTier:
        overrides.counterIntelTier ?? snapshot.modeState.counterIntelTier,
      spectatorLimit:
        overrides.spectatorLimit ?? snapshot.modeState.spectatorLimit,
      extraDisabledBots: this.unique(
        snapshot.modeState.disabledBots,
        overrides.extraDisabledBots ?? [],
      ),
    });

    const dynamicBlockedDecks: DeckType[] = [];

    if (!compiled.allowAid) {
      dynamicBlockedDecks.push('AID', 'RESCUE', 'TRUST');
    }

    if (!compiled.legendMarkersEnabled) {
      dynamicBlockedDecks.push('GHOST');
    }

    if (!compiled.allowDirectAttacks) {
      dynamicBlockedDecks.push('SABOTAGE', 'BLUFF');
    }

    const allowDefection =
      compiled.allowDefection && this.detectDefectionWindow(snapshot);

    const threatVisibilityFloor =
      snapshot.modeState.counterIntelTier >= 3
        ? this.raiseVisibility(compiled.threatPolicy.threatVisibilityFloor, 1)
        : compiled.threatPolicy.threatVisibilityFloor;

    const runtimeBadgeHints = this.unique(
      compiled.proofPolicy.badgeHints,
      this.computeRuntimeBadgeHints(snapshot),
    );

    return {
      ...compiled,
      blockedDecks: this.unique(compiled.blockedDecks, dynamicBlockedDecks),
      allowDefection,
      timingPolicy: {
        ...compiled.timingPolicy,
        phaseBoundaryWindowsRemaining:
          snapshot.modeState.phaseBoundaryWindowsRemaining,
      },
      economyPolicy: {
        ...compiled.economyPolicy,
        sharedTreasuryBalance:
          snapshot.modeState.sharedTreasuryBalance,
        allowDefection,
      },
      threatPolicy: {
        ...compiled.threatPolicy,
        counterIntelTier: snapshot.modeState.counterIntelTier,
        threatVisibilityFloor,
        disabledBots: this.unique(
          compiled.threatPolicy.disabledBots,
          snapshot.modeState.disabledBots,
        ),
        spectatorLimit: snapshot.modeState.spectatorLimit,
      },
      proofPolicy: {
        ...compiled.proofPolicy,
        badgeHints: runtimeBadgeHints,
        legendGapBias: snapshot.modeState.legendMarkersEnabled
          ? this.round(
              Math.max(
                1,
                snapshot.cards.ghostMarkers.length > 0
                  ? snapshot.cards.ghostMarkers.length * 0.10
                  : snapshot.sovereignty.gapVsLegend || 1,
              ),
            )
          : 0,
      },
    };
  }

  public isCardLegal(
    card: CardDefinition | CardInstance,
    rules: CompiledModeRules,
    options: {
      readonly timing?: TimingClass;
      readonly targeting?: Targeting;
    } = {},
  ): ModeCardLegalityResult {
    const projection = this.projectCard(card, rules);
    const reasons: string[] = [...projection.reasons];
    const warnings: string[] = [];

    if (!projection.legalInMode) {
      reasons.push('Card is not legal in the compiled mode rules.');
    }

    if (options.timing !== undefined) {
      if (!projection.allowedTimingClasses.includes(options.timing)) {
        reasons.push(`Timing ${options.timing} is not legal for this card in mode.`);
      } else if (!rules.timingPolicy.priorityTimingClasses.includes(options.timing)) {
        warnings.push(`Timing ${options.timing} is legal but not priority-optimized.`);
      }
    }

    if (options.targeting !== undefined) {
      if (!projection.allowedTargetings.includes(options.targeting)) {
        reasons.push(
          `Targeting ${options.targeting} is not legal for this card in mode.`,
        );
      }
    }

    return {
      ok: reasons.length === 0,
      reasons,
      warnings,
      projection,
    };
  }

  public projectCard(
    card: CardDefinition | CardInstance,
    rules: CompiledModeRules,
  ): CompiledCardProjection {
    const definition = this.toDefinition(card);
    const overlay = this.resolveOverlay(definition, rules.mode);
    const baseCost = 'cost' in card ? card.cost : definition.baseCost;
    const baseTargeting = overlay?.targetingOverride ?? definition.targeting;

    const deckMultiplier = this.deckCostMultiplier(rules.mode, definition.deckType);
    const effectMultiplier =
      this.deckEffectMultiplier(rules.mode, definition.deckType) *
      (overlay?.effectModifier ?? 1);

    const effectiveCost = this.round3(
      Math.max(0, baseCost * deckMultiplier * (overlay?.costModifier ?? 1)),
    );

    const legalTimingSurface =
      overlay?.timingLock !== undefined && overlay.timingLock.length > 0
        ? definition.timingClass.filter((timing) => overlay.timingLock.includes(timing))
        : definition.timingClass;

    const allowedTimingClasses = legalTimingSurface.filter((timing) =>
      rules.timingPolicy.allowedTimingClasses.includes(timing),
    );

    const allowedTargetings = rules.allowedTargetings.filter((targeting) =>
      this.isTargetAllowedByCard(baseTargeting, targeting),
    );

    const reasons: string[] = [];

    if (!definition.modeLegal.includes(rules.mode)) {
      reasons.push(`Card definition does not list mode=${rules.mode} as legal.`);
    }

    if (rules.blockedDecks.includes(definition.deckType)) {
      reasons.push(`Deck type ${definition.deckType} is blocked for mode=${rules.mode}.`);
    }

    if (overlay?.legal === false) {
      reasons.push(`Mode overlay marks card illegal for mode=${rules.mode}.`);
    }

    if (allowedTimingClasses.length === 0) {
      reasons.push('No timing classes survive mode compilation.');
    }

    if (allowedTargetings.length === 0) {
      reasons.push('No legal targets survive mode compilation.');
    }

    return {
      cardId: definition.id,
      deckType: definition.deckType,
      effectiveCost,
      effectMultiplier: this.round3(effectMultiplier),
      targeting: baseTargeting,
      allowedTimingClasses,
      allowedTargetings,
      legalInMode: reasons.length === 0,
      reasons,
    };
  }

  private detectDefectionWindow(snapshot: RunStateSnapshot): boolean {
    if (snapshot.mode !== 'coop') {
      return false;
    }

    const trustScores = Object.values(snapshot.modeState.trustScores)
      .filter((value): value is number => typeof value === 'number');

    const activeDefection = Object.values(snapshot.modeState.defectionStepByPlayer)
      .some((value) => typeof value === 'number' && value > 0);

    return activeDefection || trustScores.some((score) => score < 0.35);
  }

  private computeDerivedBlockedDecks(mode: ModeCode): DeckType[] {
    switch (mode) {
      case 'solo':
        return [];
      case 'pvp':
        return [];
      case 'coop':
        return ['PRIVILEGED'];
      case 'ghost':
        return ['PRIVILEGED', 'AID', 'RESCUE', 'TRUST'];
      default:
        return [];
    }
  }

  private computeRuntimeBadgeHints(snapshot: RunStateSnapshot): string[] {
    const hints: string[] = [];

    if (snapshot.modeState.sharedTreasury && snapshot.modeState.sharedTreasuryBalance > 0) {
      hints.push('SHARED_TREASURY_ACTIVE');
    }

    if (snapshot.modeState.legendMarkersEnabled && snapshot.cards.ghostMarkers.length > 0) {
      hints.push('LEGEND_MARKERS_ACTIVE');
    }

    if (snapshot.modeState.counterIntelTier >= 4) {
      hints.push('COUNTER_INTEL_TIER_4');
    }

    if (snapshot.modeState.bleedMode) {
      hints.push('BLEED_MODE_ENABLED');
    }

    if (snapshot.pressure.tier === 'T4') {
      hints.push('MAX_PRESSURE');
    }

    return hints;
  }

  private resolveOverlay(
    definition: CardDefinition,
    mode: ModeCode,
  ): Partial<ModeOverlay> | undefined {
    return definition.modeOverlay?.[mode];
  }

  private toDefinition(card: CardDefinition | CardInstance): CardDefinition {
    return 'card' in card ? card.card : card;
  }

  private deckCostMultiplier(mode: ModeCode, deckType: DeckType): number {
    switch (mode) {
      case 'solo':
        if (deckType === 'OPPORTUNITY') return 0.95;
        if (deckType === 'DISCIPLINE') return 0.90;
        if (deckType === 'PRIVILEGED') return 1.05;
        return 1.00;
      case 'pvp':
        if (deckType === 'SABOTAGE') return 0.95;
        if (deckType === 'BLUFF') return 0.90;
        if (deckType === 'COUNTER') return 1.05;
        return 1.00;
      case 'coop':
        if (deckType === 'AID' || deckType === 'RESCUE' || deckType === 'TRUST') {
          return 0.85;
        }
        if (deckType === 'COUNTER') return 0.95;
        return 1.00;
      case 'ghost':
        if (deckType === 'GHOST') return 0.90;
        if (deckType === 'DISCIPLINE') return 0.95;
        if (deckType === 'MISSED_OPPORTUNITY') return 1.10;
        return 1.00;
      default:
        return 1.00;
    }
  }

  private deckEffectMultiplier(mode: ModeCode, deckType: DeckType): number {
    switch (mode) {
      case 'solo':
        if (deckType === 'OPPORTUNITY') return 1.10;
        if (deckType === 'DISCIPLINE') return 1.12;
        return 1.00;
      case 'pvp':
        if (deckType === 'SABOTAGE') return 1.15;
        if (deckType === 'BLUFF') return 1.20;
        if (deckType === 'COUNTER') return 1.08;
        return 1.00;
      case 'coop':
        if (deckType === 'AID' || deckType === 'RESCUE' || deckType === 'TRUST') {
          return 1.20;
        }
        if (deckType === 'COUNTER') return 1.05;
        return 1.00;
      case 'ghost':
        if (deckType === 'GHOST') return 1.25;
        if (deckType === 'DISCIPLINE') return 1.10;
        return 1.00;
      default:
        return 1.00;
    }
  }

  private isTargetAllowedByCard(
    cardTargeting: Targeting,
    requestedTargeting: Targeting,
  ): boolean {
    if (cardTargeting === requestedTargeting) {
      return true;
    }

    if (cardTargeting === 'GLOBAL') {
      return requestedTargeting === 'GLOBAL';
    }

    if (cardTargeting === 'TEAM') {
      return requestedTargeting === 'TEAM' || requestedTargeting === 'TEAMMATE';
    }

    return false;
  }

  private raiseVisibility(
    value: VisibilityLevel,
    levels: number,
  ): VisibilityLevel {
    const next = Math.min(3, VISIBILITY_ORDER[value] + levels);
    return VISIBILITY_BY_ORDER[next];
  }

  private unique<T>(...groups: ReadonlyArray<readonly T[]>): T[] {
    const set = new Set<T>();

    for (const group of groups) {
      for (const item of group) {
        set.add(item);
      }
    }

    return [...set];
  }

  private round(value: number): number {
    return Number(value.toFixed(6));
  }

  private round3(value: number): number {
    return Number(value.toFixed(3));
  }
}