/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/BotProfileRegistry.ts
 *
 * Doctrine:
 * - profiles are stable combat doctrine, not runtime state
 * - order is deterministic and should never depend on object iteration order
 * - all lookups must be O(1) once registry is constructed
 * - registry is also the canonical backend index for mode bias, category bias,
 *   activation envelope inspection, and deterministic reporting
 */

import type { HaterBotId, ModeCode } from '../core/GamePrimitives';
import type { BotProfile } from './types';

type AggressionBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
type ActivationBand = 'EARLY' | 'MID' | 'LATE' | 'FINAL';
type ProfileComparator = (left: BotProfile, right: BotProfile) => number;

interface DoctrineEnvelope {
  readonly activationFloor: number;
  readonly activationCeiling: number;
  readonly aggressionBand: AggressionBand;
  readonly activationBand: ActivationBand;
  readonly modePeak: ModeCode;
  readonly modeTrough: ModeCode;
  readonly totalModeBias: number;
  readonly weightedPressureBias: number;
  readonly weightedHeatBias: number;
  readonly weightedRivalryBias: number;
}

interface ThreatEnvelopeInput {
  readonly pressureScore: number;
  readonly baseHeat: number;
  readonly rivalryHeatCarry: number;
  readonly mode: ModeCode;
}

const BOT_PROFILES: readonly BotProfile[] = Object.freeze([
  {
    botId: 'BOT_01',
    label: 'LIQUIDATOR',
    archetype: 'overleveraged liquidation force',
    activationThreshold: 16,
    watchWindow: 8,
    targetWindow: 18,
    aggression: 74,
    preferredCategory: 'EXTRACTION',
    preferredLayer: 'L1',
    preferredTargetEntity: 'OPPONENT',
    cooldownTicks: 2,
    pressureWeight: 0.65,
    heatWeight: 0.40,
    rivalryWeight: 0.30,
    modeWeight: {
      solo: 2,
      pvp: 10,
      coop: 1,
      ghost: 4,
    },
    notes: [
      'cash-hungry',
      'opens with rapid extraction attempts',
      'punishes visible liquidity',
      'prefers tempo theft over theatrical warnings',
    ],
  },
  {
    botId: 'BOT_02',
    label: 'BUREAUCRAT',
    archetype: 'administrative friction and timing denial',
    activationThreshold: 24,
    watchWindow: 10,
    targetWindow: 16,
    aggression: 58,
    preferredCategory: 'LOCK',
    preferredLayer: 'L2',
    preferredTargetEntity: 'PLAYER',
    cooldownTicks: 3,
    pressureWeight: 0.50,
    heatWeight: 0.55,
    rivalryWeight: 0.20,
    modeWeight: {
      solo: 8,
      pvp: 3,
      coop: 6,
      ghost: 2,
    },
    notes: [
      'window-denial',
      'targets credit flexibility and tempo',
      'likes exposed phase transitions',
      'weaponizes drag and friction',
    ],
  },
  {
    botId: 'BOT_03',
    label: 'MANIPULATOR',
    archetype: 'manufactured fear and social distortion',
    activationThreshold: 31,
    watchWindow: 10,
    targetWindow: 18,
    aggression: 63,
    preferredCategory: 'HEAT',
    preferredLayer: 'L4',
    preferredTargetEntity: 'TEAM',
    cooldownTicks: 3,
    pressureWeight: 0.55,
    heatWeight: 0.45,
    rivalryWeight: 0.45,
    modeWeight: {
      solo: 4,
      pvp: 7,
      coop: 10,
      ghost: 5,
    },
    notes: [
      'trust-pressure',
      'punishes visible coordination',
      'swarms witness channels',
      'strong when social confidence becomes visible',
    ],
  },
  {
    botId: 'BOT_04',
    label: 'CRASH_PROPHET',
    archetype: 'income destabilizer and collapse amplifier',
    activationThreshold: 43,
    watchWindow: 8,
    targetWindow: 14,
    aggression: 79,
    preferredCategory: 'DRAIN',
    preferredLayer: 'L3',
    preferredTargetEntity: 'PLAYER',
    cooldownTicks: 4,
    pressureWeight: 0.80,
    heatWeight: 0.35,
    rivalryWeight: 0.25,
    modeWeight: {
      solo: 6,
      pvp: 5,
      coop: 5,
      ghost: 7,
    },
    notes: [
      'late pressure punisher',
      'attacks income stability',
      'converts wobble into debt gravity',
      'gains edge when pressure bands climb quickly',
    ],
  },
  {
    botId: 'BOT_05',
    label: 'LEGACY_HEIR',
    archetype: 'old-money moat and final sovereignty breach',
    activationThreshold: 58,
    watchWindow: 8,
    targetWindow: 12,
    aggression: 88,
    preferredCategory: 'BREACH',
    preferredLayer: 'L4',
    preferredTargetEntity: 'PLAYER',
    cooldownTicks: 5,
    pressureWeight: 0.75,
    heatWeight: 0.30,
    rivalryWeight: 0.40,
    modeWeight: {
      solo: 5,
      pvp: 8,
      coop: 4,
      ghost: 12,
    },
    notes: [
      'late-game closer',
      'pushes network-core collapse',
      'wants the mythic finish',
      'strongest when the room already smells blood',
    ],
  },
]);

function stableCompare(left: string, right: string): number {
  return left.localeCompare(right);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class BotProfileRegistry {
  private readonly orderedProfiles = BOT_PROFILES.slice();

  private readonly profileById: Readonly<Record<HaterBotId, BotProfile>> =
    Object.freeze(
      BOT_PROFILES.reduce<Record<HaterBotId, BotProfile>>(
        (accumulator, profile) => {
          accumulator[profile.botId] = profile;
          return accumulator;
        },
        {} as Record<HaterBotId, BotProfile>,
      ),
    );

  private readonly orderedIds = Object.freeze(
    BOT_PROFILES.map((profile) => profile.botId).slice(),
  );

  private readonly profilesByCategory = Object.freeze(
    BOT_PROFILES.reduce<Record<string, readonly BotProfile[]>>((accumulator, profile) => {
      const current = accumulator[profile.preferredCategory] ?? [];
      accumulator[profile.preferredCategory] = Object.freeze(
        [...current, profile].sort(this.compareProfilesByOrder),
      );
      return accumulator;
    }, {}),
  );

  private readonly profilesByModeWeight = Object.freeze({
    solo: this.buildModeOrder('solo'),
    pvp: this.buildModeOrder('pvp'),
    coop: this.buildModeOrder('coop'),
    ghost: this.buildModeOrder('ghost'),
  });

  private readonly doctrineById = Object.freeze(
    BOT_PROFILES.reduce<Record<HaterBotId, DoctrineEnvelope>>((accumulator, profile) => {
      accumulator[profile.botId] = this.buildDoctrineEnvelope(profile);
      return accumulator;
    }, {} as Record<HaterBotId, DoctrineEnvelope>),
  );

  public all(): readonly BotProfile[] {
    return this.orderedProfiles;
  }

  public ids(): readonly HaterBotId[] {
    return this.orderedIds;
  }

  public byId(botId: HaterBotId): BotProfile {
    return this.profileById[botId];
  }

  public require(botId: HaterBotId): BotProfile {
    const profile = this.profileById[botId];
    if (!profile) {
      throw new Error(`[BotProfileRegistry] Unknown bot profile: ${botId}`);
    }
    return profile;
  }

  public has(botId: HaterBotId): boolean {
    return Boolean(this.profileById[botId]);
  }

  public count(): number {
    return this.orderedProfiles.length;
  }

  public first(): BotProfile {
    return this.orderedProfiles[0];
  }

  public last(): BotProfile {
    return this.orderedProfiles[this.orderedProfiles.length - 1];
  }

  public byCategory(category: BotProfile['preferredCategory']): readonly BotProfile[] {
    return this.profilesByCategory[category] ?? [];
  }

  public forMode(mode: ModeCode): readonly BotProfile[] {
    return this.profilesByModeWeight[mode];
  }

  public strongestForMode(mode: ModeCode, limit = this.count()): readonly BotProfile[] {
    return this.forMode(mode).slice(0, clamp(limit, 0, this.count()));
  }

  public weakestForMode(mode: ModeCode, limit = this.count()): readonly BotProfile[] {
    const ordered = this.forMode(mode);
    return ordered.slice(
      Math.max(0, ordered.length - clamp(limit, 0, this.count())),
      ordered.length,
    );
  }

  public aggressionBand(botId: HaterBotId): AggressionBand {
    return this.doctrineById[botId].aggressionBand;
  }

  public activationBand(botId: HaterBotId): ActivationBand {
    return this.doctrineById[botId].activationBand;
  }

  public modePeak(botId: HaterBotId): ModeCode {
    return this.doctrineById[botId].modePeak;
  }

  public modeTrough(botId: HaterBotId): ModeCode {
    return this.doctrineById[botId].modeTrough;
  }

  public modeBias(botId: HaterBotId, mode: ModeCode): number {
    return this.require(botId).modeWeight[mode];
  }

  public activationFloor(botId: HaterBotId): number {
    return this.doctrineById[botId].activationFloor;
  }

  public activationCeiling(botId: HaterBotId): number {
    return this.doctrineById[botId].activationCeiling;
  }

  public doctrineEnvelope(botId: HaterBotId): DoctrineEnvelope {
    return this.doctrineById[botId];
  }

  public doctrineSummary(botId: HaterBotId): Record<string, string | number> {
    const profile = this.require(botId);
    const doctrine = this.doctrineById[botId];

    return {
      botId: profile.botId,
      label: profile.label,
      archetype: profile.archetype,
      aggression: profile.aggression,
      aggressionBand: doctrine.aggressionBand,
      activationThreshold: profile.activationThreshold,
      activationFloor: doctrine.activationFloor,
      activationCeiling: doctrine.activationCeiling,
      activationBand: doctrine.activationBand,
      modePeak: doctrine.modePeak,
      modeTrough: doctrine.modeTrough,
      preferredCategory: profile.preferredCategory,
      preferredLayer: profile.preferredLayer,
      preferredTargetEntity: profile.preferredTargetEntity,
      cooldownTicks: profile.cooldownTicks,
      totalModeBias: doctrine.totalModeBias,
    };
  }

  public threatFloor(botId: HaterBotId, input: ThreatEnvelopeInput): number {
    const profile = this.require(botId);
    const doctrine = this.doctrineById[botId];

    const value =
      input.pressureScore * 100 * profile.pressureWeight * 0.45 +
      input.baseHeat * profile.heatWeight * 0.18 +
      input.rivalryHeatCarry * profile.rivalryWeight * 0.14 +
      profile.modeWeight[input.mode] * 1.1 +
      doctrine.activationFloor * 0.08;

    return round2(clamp(value, 0, 100));
  }

  public threatCeiling(botId: HaterBotId, input: ThreatEnvelopeInput): number {
    const profile = this.require(botId);
    const doctrine = this.doctrineById[botId];

    const value =
      input.pressureScore * 100 * profile.pressureWeight * 0.92 +
      input.baseHeat * profile.heatWeight * 0.48 +
      input.rivalryHeatCarry * profile.rivalryWeight * 0.32 +
      profile.modeWeight[input.mode] * 1.8 +
      doctrine.activationCeiling * 0.22 +
      profile.aggression * 0.4;

    return round2(clamp(value, 0, 100));
  }

  public deterministicRank(botId: HaterBotId): number {
    return this.orderedIds.indexOf(botId);
  }

  public compareByMode(mode: ModeCode): ProfileComparator {
    const order = new Map<HaterBotId, number>(
      this.forMode(mode).map((profile, index) => [profile.botId, index]),
    );

    return (left, right) => {
      const leftIndex = order.get(left.botId) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = order.get(right.botId) ?? Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return stableCompare(left.botId, right.botId);
    };
  }

  public compareByActivation(): ProfileComparator {
    return (left, right) => {
      if (left.activationThreshold !== right.activationThreshold) {
        return left.activationThreshold - right.activationThreshold;
      }

      return stableCompare(left.botId, right.botId);
    };
  }

  public compareByAggression(): ProfileComparator {
    return (left, right) => {
      if (left.aggression !== right.aggression) {
        return right.aggression - left.aggression;
      }

      return stableCompare(left.botId, right.botId);
    };
  }

  public explainModeOrder(mode: ModeCode): readonly string[] {
    return this.forMode(mode).map((profile, index) => {
      const doctrine = this.doctrineById[profile.botId];
      return [
        `${String(index + 1)}.`,
        profile.botId,
        profile.label,
        `mode:${String(profile.modeWeight[mode])}`,
        `agg:${String(profile.aggression)}`,
        `threshold:${String(profile.activationThreshold)}`,
        `peak:${doctrine.modePeak}`,
      ].join(' ');
    });
  }

  public listCategoryMatrix(): Readonly<Record<string, readonly string[]>> {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(this.profilesByCategory).map(([category, profiles]) => [
          category,
          profiles.map((profile) => profile.botId),
        ]),
      ),
    );
  }

  public listModeMatrix(): Readonly<Record<ModeCode, readonly string[]>> {
    return Object.freeze({
      solo: this.profilesByModeWeight.solo.map((profile) => profile.botId),
      pvp: this.profilesByModeWeight.pvp.map((profile) => profile.botId),
      coop: this.profilesByModeWeight.coop.map((profile) => profile.botId),
      ghost: this.profilesByModeWeight.ghost.map((profile) => profile.botId),
    });
  }

  public totalAggression(): number {
    return this.orderedProfiles.reduce((sum, profile) => sum + profile.aggression, 0);
  }

  public averageAggression(): number {
    return round2(this.totalAggression() / Math.max(1, this.count()));
  }

  public activationExtremes(): {
    readonly earliest: BotProfile;
    readonly latest: BotProfile;
  } {
    const ordered = [...this.orderedProfiles].sort(this.compareByActivation());
    return {
      earliest: ordered[0],
      latest: ordered[ordered.length - 1],
    };
  }

  public aggressionExtremes(): {
    readonly lowest: BotProfile;
    readonly highest: BotProfile;
  } {
    const ordered = [...this.orderedProfiles].sort(this.compareByAggression());
    return {
      lowest: ordered[ordered.length - 1],
      highest: ordered[0],
    };
  }

  public diagnosticTable(): readonly Record<string, string | number>[] {
    return this.orderedProfiles.map((profile) => {
      const doctrine = this.doctrineById[profile.botId];
      return {
        botId: profile.botId,
        label: profile.label,
        category: profile.preferredCategory,
        target: profile.preferredTargetEntity,
        layer: profile.preferredLayer,
        threshold: profile.activationThreshold,
        aggression: profile.aggression,
        aggressionBand: doctrine.aggressionBand,
        activationBand: doctrine.activationBand,
        solo: profile.modeWeight.solo,
        pvp: profile.modeWeight.pvp,
        coop: profile.modeWeight.coop,
        ghost: profile.modeWeight.ghost,
        peak: doctrine.modePeak,
        trough: doctrine.modeTrough,
      };
    });
  }

  private buildModeOrder(mode: ModeCode): readonly BotProfile[] {
    return Object.freeze(
      [...BOT_PROFILES].sort((left, right) => {
        const leftScore = this.modeCompositeScore(left, mode);
        const rightScore = this.modeCompositeScore(right, mode);

        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }

        return stableCompare(left.botId, right.botId);
      }),
    );
  }

  private buildDoctrineEnvelope(profile: BotProfile): DoctrineEnvelope {
    const modePairs = (Object.keys(profile.modeWeight) as ModeCode[]).map((mode) => ({
      mode,
      value: profile.modeWeight[mode],
    }));

    const peak = [...modePairs].sort((left, right) => {
      if (left.value !== right.value) {
        return right.value - left.value;
      }

      return stableCompare(left.mode, right.mode);
    })[0];

    const trough = [...modePairs].sort((left, right) => {
      if (left.value !== right.value) {
        return left.value - right.value;
      }

      return stableCompare(left.mode, right.mode);
    })[0];

    return {
      activationFloor: profile.activationThreshold,
      activationCeiling:
        profile.activationThreshold + profile.watchWindow + profile.targetWindow,
      aggressionBand: this.resolveAggressionBand(profile.aggression),
      activationBand: this.resolveActivationBand(profile.activationThreshold),
      modePeak: peak.mode,
      modeTrough: trough.mode,
      totalModeBias: modePairs.reduce((sum, entry) => sum + entry.value, 0),
      weightedPressureBias: round2(profile.pressureWeight * profile.aggression),
      weightedHeatBias: round2(profile.heatWeight * profile.aggression),
      weightedRivalryBias: round2(profile.rivalryWeight * profile.aggression),
    };
  }

  private modeCompositeScore(profile: BotProfile, mode: ModeCode): number {
    return round2(
      profile.modeWeight[mode] * 4 +
        profile.aggression * 0.46 +
        profile.pressureWeight * 18 +
        profile.heatWeight * 12 +
        profile.rivalryWeight * 10 -
        profile.cooldownTicks * 1.5 -
        profile.activationThreshold * 0.08,
    );
  }

  private resolveAggressionBand(aggression: number): AggressionBand {
    if (aggression >= 85) {
      return 'EXTREME';
    }

    if (aggression >= 70) {
      return 'HIGH';
    }

    if (aggression >= 55) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private resolveActivationBand(threshold: number): ActivationBand {
    if (threshold <= 20) {
      return 'EARLY';
    }

    if (threshold <= 35) {
      return 'MID';
    }

    if (threshold <= 50) {
      return 'LATE';
    }

    return 'FINAL';
  }

  private compareProfilesByOrder = (left: BotProfile, right: BotProfile): number => {
    const leftIndex = BOT_PROFILES.findIndex((profile) => profile.botId === left.botId);
    const rightIndex = BOT_PROFILES.findIndex((profile) => profile.botId === right.botId);

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return stableCompare(left.botId, right.botId);
  };
}
