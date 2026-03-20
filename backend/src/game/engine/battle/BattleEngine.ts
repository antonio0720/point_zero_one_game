/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/BattleEngine.ts
 *
 * Doctrine:
 * - battle is backend-authoritative and immutable-input compliant
 * - engine output must be a new snapshot, never an in-place mutation
 * - hostile posture, injections, and counterplay economy are deterministic
 * - do not duplicate baseline budget accrual or cooldown decay already handled by EngineRuntime
 * - battle is also a social-pressure producer for the canonical chat estate
 * - every emitted attack should be explainable by mode, pressure, rivalry, and profile doctrine
 */

import type {
  EngineHealth,
  EngineTickResult,
  SimulationEngine,
  TickContext,
} from '../core/EngineContracts';
import type {
  AttackCategory,
  AttackEvent,
  HaterBotId,
  ModeCode,
} from '../core/GamePrimitives';
import type {
  BotRuntimeState,
  RunStateSnapshot,
} from '../core/RunStateSnapshot';
import {
  createEngineHealth,
  createEngineSignal,
} from '../core/EngineContracts';
import { BotProfileRegistry } from './BotProfileRegistry';
import { HaterBotController } from './HaterBotController';
import { BattleBudgetManager } from './BattleBudgetManager';
import { AttackInjector } from './AttackInjector';
import type { BotEvolveResult, BotProfile } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function stableCompare(left: string, right: string): number {
  return left.localeCompare(right);
}

type CounterIntelGrade = 'NONE' | 'HINT' | 'MEDIUM' | 'HIGH' | 'FULL';
type BattleTempoBand = 'QUIET' | 'BUILDING' | 'SHARP' | 'SURGING' | 'OVERRUN';
type InjectionGateReason =
  | 'BOT_NEUTRALIZED'
  | 'MODE_DISABLED'
  | 'NOT_ATTACKING'
  | 'ON_COOLDOWN'
  | 'PVP_EXTRACTION_LOCK'
  | 'GHOST_MARKER_REQUIRED'
  | 'PENDING_CAP_REACHED'
  | 'MODE_PHASE_RESTRICTED'
  | 'PRESSURE_TOO_LOW'
  | 'BUDGET_LOCKED'
  | 'NO_BLOCK';

interface ModeIntel {
  readonly mode: ModeCode;
  readonly baseHeatBias: number;
  readonly rivalryBias: number;
  readonly groupPressureBias: number;
  readonly maxSimultaneousInjections: number;
  readonly pendingAttackCap: number;
  readonly extractionCooldownOnHostileFire: number;
  readonly chatWitnessBias: number;
  readonly opportunityCursorMultiplier: number;
  readonly counterIntelBias: number;
  readonly phaseRestrictionFactor: number;
  readonly notes: readonly string[];
}

interface HeatProfile {
  readonly communityHeat: number;
  readonly projectedPendingTax: number;
  readonly rivalryCarry: number;
  readonly legendPressure: number;
  readonly trustPressure: number;
  readonly baseHeat: number;
  readonly tempoBand: BattleTempoBand;
}

interface RuntimeProfilePair {
  readonly profile: BotProfile;
  readonly runtime: BotRuntimeState;
  readonly index: number;
}

interface EvolvedBotEntry {
  readonly profile: BotProfile;
  readonly runtimeBefore: BotRuntimeState;
  readonly runtimeAfter: BotRuntimeState;
  readonly previousState: BotRuntimeState['state'];
  readonly nextState: BotRuntimeState['state'];
  readonly stateChanged: boolean;
  readonly compositeThreat: number;
  readonly threatBand: BattleTempoBand;
  readonly postureScore: number;
  readonly attackUrgency: number;
  readonly chatWeight: number;
  readonly counterIntelGrade: CounterIntelGrade;
  readonly sceneWeight: number;
  readonly notes: readonly string[];
}

interface InjectionGateResult {
  readonly allowed: boolean;
  readonly reason: InjectionGateReason;
  readonly detail: readonly string[];
}

interface AttackIntent {
  readonly entry: EvolvedBotEntry;
  readonly gate: InjectionGateResult;
  readonly priority: number;
  readonly reservePriority: number;
  readonly orchestrationTags: readonly string[];
}

interface InjectionPlan {
  readonly selected: readonly AttackIntent[];
  readonly blocked: readonly AttackIntent[];
  readonly reserved: readonly AttackIntent[];
  readonly limit: number;
}

interface CounterIntelReveal {
  readonly botId: HaterBotId;
  readonly grade: CounterIntelGrade;
  readonly posture: BotRuntimeState['state'];
  readonly confidence: number;
  readonly profile: {
    readonly label: string;
    readonly archetype: string;
    readonly preferredCategory: AttackCategory;
    readonly preferredLayer: string;
    readonly cooldownTicks: number;
  };
  readonly risk: {
    readonly pressureThreat: number;
    readonly compositeThreat: number;
    readonly urgency: number;
  };
  readonly notes: readonly string[];
}

interface SocialPressureFrame {
  readonly audienceHeatDelta: number;
  readonly humiliationPressureDelta: number;
  readonly hypePressureDelta: number;
  readonly witnessTier: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly sceneKey: string;
  readonly tags: readonly string[];
}

interface PendingAttackMergeResult {
  readonly pending: AttackEvent[];
  readonly prunedCount: number;
}

interface BattleDiagnostics {
  readonly baseHeat: HeatProfile;
  readonly tempoBand: BattleTempoBand;
  readonly selectedCount: number;
  readonly blockedCount: number;
  readonly reservedCount: number;
  readonly counterIntelCount: number;
  readonly projectedPressureTax: number;
  readonly rivalryHeatNext: number;
  readonly extractionCooldownNext: number;
  readonly sharedOpportunityCursorNext: number;
}

const BATTLE_STEP = 'STEP_05_BATTLE';
const MAX_SIGNAL_TAGS = 16;
const DEFAULT_PENDING_ATTACK_CAP = 64;
const DEFAULT_MIN_ATTACK_PRESSURE = 0.08;

export class BattleEngine implements SimulationEngine {
  public readonly engineId = 'battle' as const;

  private readonly profiles = new BotProfileRegistry();
  private readonly controller = new HaterBotController();
  private readonly budget = new BattleBudgetManager();
  private readonly injector = new AttackInjector();

  public reset(): void {}

  public canRun(snapshot: RunStateSnapshot, context: TickContext): boolean {
    return context.step === BATTLE_STEP && snapshot.outcome === null;
  }

  public tick(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): RunStateSnapshot | EngineTickResult {
    if (!this.canRun(snapshot, context)) {
      return {
        snapshot,
        signals: [
          createEngineSignal(
            this.engineId,
            'INFO',
            'BATTLE_SKIPPED',
            'BattleEngine skipped for this step or terminal state.',
            snapshot.tick,
          ),
        ],
      };
    }

    const modeIntel = this.buildModeIntel(snapshot);
    const heatProfile = this.buildHeatProfile(snapshot, modeIntel);
    const runtimePairs = this.buildRuntimeProfilePairs(snapshot);
    const evolutions = runtimePairs.map((pair) =>
      this.evolveBotEntry(pair, snapshot, heatProfile, modeIntel),
    );

    const stateSignals = this.emitAndBuildStateSignals(evolutions, snapshot, context);
    const counterIntel = this.buildCounterIntelReveals(
      evolutions,
      snapshot,
      modeIntel,
    );

    const plan = this.buildInjectionPlan(
      evolutions,
      snapshot,
      heatProfile,
      modeIntel,
    );

    const injectedAttacks = this.materializeInjectedAttacks(
      plan.selected,
      snapshot,
      context,
      modeIntel,
    );

    const botsAfterInjection = this.resolveBotsAfterInjection(
      evolutions,
      injectedAttacks,
      snapshot,
      modeIntel,
    );

    const budgetResolution = this.budget.resolveAfterInjection({
      current: snapshot.battle.battleBudget,
      cap: snapshot.battle.battleBudgetCap,
      mode: snapshot.mode,
      injectedAttacks,
      firstBloodClaimed: snapshot.battle.firstBloodClaimed,
    });

    const mergeResult = this.mergePendingAttacks(
      snapshot.battle.pendingAttacks,
      injectedAttacks,
      modeIntel.pendingAttackCap,
    );

    const nextExtractionCooldown = this.resolveExtractionCooldown(
      snapshot,
      injectedAttacks,
      modeIntel,
    );

    const nextRivalryHeatCarry = this.resolveRivalryHeatCarry(
      snapshot,
      evolutions,
      botsAfterInjection,
      injectedAttacks,
      heatProfile,
      modeIntel,
    );

    const sharedOpportunityCursorNext = this.resolveSharedOpportunityCursor(
      snapshot,
      injectedAttacks,
      modeIntel,
    );

    const nextSnapshot: RunStateSnapshot = {
      ...snapshot,
      battle: {
        ...snapshot.battle,
        bots: botsAfterInjection,
        battleBudget: budgetResolution.battleBudget,
        extractionCooldownTicks: nextExtractionCooldown,
        firstBloodClaimed: budgetResolution.firstBloodClaimed,
        pendingAttacks: mergeResult.pending,
        sharedOpportunityDeckCursor: sharedOpportunityCursorNext,
        rivalryHeatCarry: nextRivalryHeatCarry,
        neutralizedBotIds: this.resolveNeutralizedBotIds(botsAfterInjection),
      },
    };

    const projectedPressureTax = this.budget.resolveProjectedPressureTax(
      mergeResult.pending,
    );

    const diagnostics: BattleDiagnostics = {
      baseHeat: heatProfile,
      tempoBand: heatProfile.tempoBand,
      selectedCount: plan.selected.length,
      blockedCount: plan.blocked.length,
      reservedCount: plan.reserved.length,
      counterIntelCount: counterIntel.length,
      projectedPressureTax,
      rivalryHeatNext: nextRivalryHeatCarry,
      extractionCooldownNext: nextExtractionCooldown,
      sharedOpportunityCursorNext,
    };

    const resultSignals = this.buildResultSignals(
      snapshot,
      evolutions,
      plan,
      injectedAttacks,
      budgetResolution.notes,
      counterIntel,
      diagnostics,
      mergeResult.prunedCount,
      modeIntel.pendingAttackCap,
    );

    this.emitCounterIntel(counterIntel, snapshot, context);
    this.emitSocialPressureFrames(
      snapshot,
      context,
      injectedAttacks,
      evolutions,
      heatProfile,
      modeIntel,
    );
    this.emitAttackAuthorityEvents(
      snapshot,
      context,
      injectedAttacks,
      evolutions,
      projectedPressureTax,
      heatProfile,
      modeIntel,
    );
    this.emitBudgetAndDiagnostics(
      snapshot,
      context,
      budgetResolution.battleBudget,
      projectedPressureTax,
      diagnostics,
    );

    return {
      snapshot: nextSnapshot,
      signals: [...stateSignals, ...resultSignals],
    };
  }

  public getHealth(): EngineHealth {
    return createEngineHealth(this.engineId, 'HEALTHY', Date.now(), [
      'battle-engine-online',
      'immutable-input-compliant',
      'deterministic-hostile-orchestration',
      'chat-pressure-bridge-enabled',
    ]);
  }

  private buildRuntimeProfilePairs(snapshot: RunStateSnapshot): RuntimeProfilePair[] {
    const runtimeBots = this.hydrateRuntimeBots(snapshot);
    const orderedProfiles = this.profiles.all();

    return orderedProfiles.map((profile, index) => {
      const runtime = runtimeBots.find((bot) => bot.botId === profile.botId);

      if (!runtime) {
        return {
          profile,
          runtime: {
            botId: profile.botId,
            label: profile.label,
            state: 'DORMANT',
            heat: 0,
            lastAttackTick: null,
            attacksLanded: 0,
            attacksBlocked: 0,
            neutralized: false,
          },
          index,
        };
      }

      return {
        profile,
        runtime,
        index,
      };
    });
  }

  private hydrateRuntimeBots(snapshot: RunStateSnapshot): BotRuntimeState[] {
    const existingById = new Map<HaterBotId, BotRuntimeState>(
      snapshot.battle.bots.map((bot) => [bot.botId, bot]),
    );

    const disabled = new Set<HaterBotId>(snapshot.modeState.disabledBots);
    const neutralized = new Set<HaterBotId>(snapshot.battle.neutralizedBotIds);

    return this.profiles.all().map((profile) => {
      const existing = existingById.get(profile.botId);
      const isNeutralized =
        disabled.has(profile.botId) || neutralized.has(profile.botId);

      if (!existing) {
        return {
          botId: profile.botId,
          label: profile.label,
          state: isNeutralized ? 'NEUTRALIZED' : 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: isNeutralized,
        };
      }

      return isNeutralized
        ? {
            ...existing,
            state: 'NEUTRALIZED',
            neutralized: true,
            heat: 0,
          }
        : existing;
    });
  }

  private buildModeIntel(snapshot: RunStateSnapshot): ModeIntel {
    const hasSharedTreasury = Boolean(snapshot.modeState.sharedTreasury);
    const trustEntryCount = Object.keys(snapshot.modeState.trustScores ?? {}).length;
    const disabledCount = snapshot.modeState.disabledBots.length;
    const ghostMarkers = snapshot.cards.ghostMarkers.length;
    const counterIntelTier = snapshot.modeState.counterIntelTier ?? 0;

    switch (snapshot.mode) {
      case 'pvp':
        return {
          mode: snapshot.mode,
          baseHeatBias: 8,
          rivalryBias: 12,
          groupPressureBias: 0,
          maxSimultaneousInjections: 2,
          pendingAttackCap: 72,
          extractionCooldownOnHostileFire: 3,
          chatWitnessBias: 12,
          opportunityCursorMultiplier: 1,
          counterIntelBias: clamp(counterIntelTier + 1, 1, 4),
          phaseRestrictionFactor:
            snapshot.modeState.extractionActionsRemaining <= 0 ? 0.72 : 1,
          notes: [
            'pvp-duel-doctrine',
            'extraction-hostility-is-premium',
            `disabled-bots:${String(disabledCount)}`,
          ],
        };
      case 'coop':
        return {
          mode: snapshot.mode,
          baseHeatBias: hasSharedTreasury ? 6 : 3,
          rivalryBias: 4,
          groupPressureBias: clamp(4 + trustEntryCount, 4, 12),
          maxSimultaneousInjections: hasSharedTreasury ? 3 : 2,
          pendingAttackCap: 80,
          extractionCooldownOnHostileFire: 2,
          chatWitnessBias: 10,
          opportunityCursorMultiplier: hasSharedTreasury ? 2 : 1,
          counterIntelBias: clamp(counterIntelTier + trustEntryCount, 1, 4),
          phaseRestrictionFactor:
            snapshot.modeState.phaseBoundaryWindowsRemaining > 0 ? 1 : 0.92,
          notes: [
            'coop-coordination-punishment',
            `trust-entries:${String(trustEntryCount)}`,
            hasSharedTreasury ? 'shared-treasury-online' : 'shared-treasury-offline',
          ],
        };
      case 'ghost':
        return {
          mode: snapshot.mode,
          baseHeatBias: 5 + Math.min(6, ghostMarkers),
          rivalryBias: 7,
          groupPressureBias: 0,
          maxSimultaneousInjections: ghostMarkers > 0 ? 2 : 1,
          pendingAttackCap: 96,
          extractionCooldownOnHostileFire: 2,
          chatWitnessBias: 14,
          opportunityCursorMultiplier: 1,
          counterIntelBias: clamp(counterIntelTier + 2, 2, 4),
          phaseRestrictionFactor: ghostMarkers > 0 ? 1 : 0.84,
          notes: [
            'ghost-legend-doctrine',
            `ghost-markers:${String(ghostMarkers)}`,
            snapshot.modeState.legendMarkersEnabled
              ? 'legend-markers-enabled'
              : 'legend-markers-disabled',
          ],
        };
      case 'solo':
      default:
        return {
          mode: snapshot.mode,
          baseHeatBias: snapshot.modeState.bleedMode ? 7 : 4,
          rivalryBias: 6,
          groupPressureBias: 0,
          maxSimultaneousInjections: 2,
          pendingAttackCap: DEFAULT_PENDING_ATTACK_CAP,
          extractionCooldownOnHostileFire: 2,
          chatWitnessBias: 9,
          opportunityCursorMultiplier: 1,
          counterIntelBias: clamp(counterIntelTier, 0, 4),
          phaseRestrictionFactor:
            snapshot.modeState.phaseBoundaryWindowsRemaining > 0 ? 1 : 0.95,
          notes: [
            'solo-isolation-doctrine',
            snapshot.modeState.holdEnabled ? 'hold-enabled' : 'hold-disabled',
            snapshot.modeState.bleedMode ? 'bleed-mode' : 'normal-mode',
          ],
        };
    }
  }

  private buildHeatProfile(
    snapshot: RunStateSnapshot,
    modeIntel: ModeIntel,
  ): HeatProfile {
    const communityHeat =
      snapshot.economy.haterHeat +
      snapshot.modeState.communityHeatModifier +
      modeIntel.baseHeatBias;

    const projectedPendingTax = this.budget.resolveProjectedPressureTax(
      snapshot.battle.pendingAttacks,
    );

    const rivalryCarry = snapshot.battle.rivalryHeatCarry + modeIntel.rivalryBias;

    const legendPressure =
      snapshot.mode === 'ghost'
        ? clamp(snapshot.cards.ghostMarkers.length * 3, 0, 15)
        : 0;

    const trustPressure =
      snapshot.mode === 'coop'
        ? clamp(
            Object.values(snapshot.modeState.trustScores ?? {}).reduce(
              (sum, value) => sum + (value < 50 ? 2 : 0),
              0,
            ) + modeIntel.groupPressureBias,
            0,
            18,
          )
        : 0;

    const baseHeat = round2(
      clamp(
        communityHeat +
          projectedPendingTax +
          rivalryCarry +
          legendPressure +
          trustPressure,
        0,
        100,
      ),
    );

    return {
      communityHeat: round2(clamp(communityHeat, 0, 100)),
      projectedPendingTax,
      rivalryCarry: round2(clamp(rivalryCarry, 0, 100)),
      legendPressure,
      trustPressure,
      baseHeat,
      tempoBand: this.resolveTempoBand(baseHeat, snapshot.pressure.score),
    };
  }

  private resolveTempoBand(baseHeat: number, pressureScore: number): BattleTempoBand {
    const scalar = baseHeat * 0.62 + pressureScore * 100 * 0.58;

    if (scalar >= 110) {
      return 'OVERRUN';
    }

    if (scalar >= 84) {
      return 'SURGING';
    }

    if (scalar >= 58) {
      return 'SHARP';
    }

    if (scalar >= 30) {
      return 'BUILDING';
    }

    return 'QUIET';
  }

  private evolveBotEntry(
    pair: RuntimeProfilePair,
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): EvolvedBotEntry {
    const baseEvolution: BotEvolveResult = this.controller.evolve(pair.runtime, pair.profile, {
      baseHeat: heatProfile.baseHeat,
      pressureScore: snapshot.pressure.score,
      rivalryHeatCarry: snapshot.battle.rivalryHeatCarry,
      mode: snapshot.mode,
      tick: snapshot.tick,
    });

    const postureScore = this.computePostureScore(
      pair.profile,
      baseEvolution,
      heatProfile,
      snapshot,
      modeIntel,
    );
    const attackUrgency = this.computeAttackUrgency(
      pair.profile,
      baseEvolution,
      snapshot,
      heatProfile,
      modeIntel,
    );
    const chatWeight = this.computeChatWeight(
      pair.profile,
      baseEvolution,
      snapshot,
      heatProfile,
      modeIntel,
    );
    const sceneWeight = this.computeSceneWeight(
      pair.profile,
      baseEvolution,
      snapshot,
      heatProfile,
      modeIntel,
      attackUrgency,
    );
    const nextHeat = this.computeNextRuntimeHeat(
      pair.runtime,
      baseEvolution,
      heatProfile,
      postureScore,
      modeIntel,
    );

    return {
      profile: pair.profile,
      runtimeBefore: pair.runtime,
      runtimeAfter: {
        ...baseEvolution.runtime,
        heat: nextHeat,
      },
      previousState: baseEvolution.previousState,
      nextState: baseEvolution.nextState,
      stateChanged: baseEvolution.stateChanged,
      compositeThreat: round2(clamp(baseEvolution.compositeThreat, 0, 100)),
      threatBand: this.resolveThreatBand(baseEvolution.compositeThreat, attackUrgency),
      postureScore,
      attackUrgency,
      chatWeight,
      counterIntelGrade: this.resolveCounterIntelGrade(
        pair.profile,
        baseEvolution,
        snapshot,
        modeIntel,
      ),
      sceneWeight,
      notes: this.compactNotes([
        ...pair.profile.notes,
        `composite:${String(round2(baseEvolution.compositeThreat))}`,
        `posture:${String(postureScore)}`,
        `urgency:${String(attackUrgency)}`,
        `chat-weight:${String(chatWeight)}`,
      ]),
    };
  }

  private resolveThreatBand(
    compositeThreat: number,
    attackUrgency: number,
  ): BattleTempoBand {
    const scalar = compositeThreat * 0.66 + attackUrgency * 0.34;

    if (scalar >= 88) {
      return 'OVERRUN';
    }

    if (scalar >= 72) {
      return 'SURGING';
    }

    if (scalar >= 54) {
      return 'SHARP';
    }

    if (scalar >= 28) {
      return 'BUILDING';
    }

    return 'QUIET';
  }

  private computePostureScore(
    profile: BotProfile,
    evolution: BotEvolveResult,
    heatProfile: HeatProfile,
    snapshot: RunStateSnapshot,
    modeIntel: ModeIntel,
  ): number {
    const stateBias = this.resolveStateBias(evolution.nextState);
    const pressureFactor = snapshot.pressure.score * profile.pressureWeight * 40;
    const heatFactor = heatProfile.baseHeat * profile.heatWeight * 0.4;
    const rivalryFactor =
      snapshot.battle.rivalryHeatCarry * profile.rivalryWeight * 0.25;
    const modeFactor = profile.modeWeight[snapshot.mode] * 1.4;
    const trustPenalty =
      snapshot.mode === 'coop' ? this.computeCoopTrustPenalty(snapshot) : 0;

    return round2(
      clamp(
        stateBias +
          pressureFactor +
          heatFactor +
          rivalryFactor +
          modeFactor -
          trustPenalty +
          modeIntel.groupPressureBias,
        0,
        100,
      ),
    );
  }

  private computeAttackUrgency(
    profile: BotProfile,
    evolution: BotEvolveResult,
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): number {
    const compositeThreat = clamp(evolution.compositeThreat, 0, 100);
    const weakLayerBonus = this.computeWeakLayerBonus(snapshot, profile);
    const cooldownPressure = this.computeCooldownPressure(
      evolution.runtime,
      profile,
      snapshot.tick,
    );
    const pressureBonus = snapshot.pressure.score * 18;
    const modeBonus = profile.modeWeight[snapshot.mode] * 1.2;
    const tempoBonus = this.resolveTempoBonus(heatProfile.tempoBand);

    return round2(
      clamp(
        compositeThreat * 0.42 +
          weakLayerBonus +
          cooldownPressure +
          pressureBonus +
          modeBonus +
          tempoBonus +
          modeIntel.baseHeatBias,
        0,
        100,
      ),
    );
  }

  private computeChatWeight(
    profile: BotProfile,
    evolution: BotEvolveResult,
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): number {
    const stateWeight =
      evolution.nextState === 'ATTACKING'
        ? 28
        : evolution.nextState === 'TARGETING'
          ? 18
          : evolution.nextState === 'WATCHING'
            ? 10
            : 4;

    const modeWitness =
      modeIntel.chatWitnessBias +
      (snapshot.mode === 'ghost'
        ? snapshot.cards.ghostMarkers.length
        : snapshot.mode === 'coop'
          ? Object.keys(snapshot.modeState.trustScores ?? {}).length
          : 0);

    const pressureWeight = snapshot.pressure.score * 22;
    const heatWeight = heatProfile.baseHeat * 0.18;
    const categoryWeight = this.resolveCategoryChatWeight(profile.preferredCategory);

    return round2(
      clamp(
        stateWeight + modeWitness + pressureWeight + heatWeight + categoryWeight,
        0,
        100,
      ),
    );
  }

  private computeSceneWeight(
    profile: BotProfile,
    evolution: BotEvolveResult,
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
    attackUrgency: number,
  ): number {
    const attackStateBias =
      evolution.nextState === 'ATTACKING'
        ? 36
        : evolution.nextState === 'TARGETING'
          ? 16
          : 6;

    const modeTheaterBonus =
      snapshot.mode === 'pvp'
        ? 12
        : snapshot.mode === 'ghost'
          ? 10
          : snapshot.mode === 'coop'
            ? 8
            : 5;

    return round2(
      clamp(
        attackStateBias +
          modeTheaterBonus +
          modeIntel.chatWitnessBias +
          this.resolveTempoBonus(heatProfile.tempoBand) +
          attackUrgency * 0.28 +
          this.resolveCategorySceneWeight(profile.preferredCategory),
        0,
        100,
      ),
    );
  }

  private computeNextRuntimeHeat(
    runtimeBefore: BotRuntimeState,
    evolution: BotEvolveResult,
    heatProfile: HeatProfile,
    postureScore: number,
    modeIntel: ModeIntel,
  ): number {
    const stateBias = this.resolveStateHeatBias(evolution.nextState);
    const carry = runtimeBefore.heat * 0.42;
    const ambient = heatProfile.baseHeat * 0.18;
    const posture = postureScore * 0.22;
    const neutralizedPenalty = evolution.runtime.neutralized ? 100 : 0;

    return round2(
      clamp(
        neutralizedPenalty > 0
          ? 0
          : carry + ambient + posture + stateBias + modeIntel.baseHeatBias,
        0,
        100,
      ),
    );
  }

  private resolveCounterIntelGrade(
    profile: BotProfile,
    evolution: BotEvolveResult,
    snapshot: RunStateSnapshot,
    modeIntel: ModeIntel,
  ): CounterIntelGrade {
    const scalar =
      snapshot.modeState.counterIntelTier * 18 +
      evolution.compositeThreat * 0.34 +
      clamp(evolution.compositeThreat * 0.24, 0, 24) +
      modeIntel.counterIntelBias * 8 +
      profile.aggression * 0.12;

    if (scalar >= 82) {
      return 'FULL';
    }

    if (scalar >= 62) {
      return 'HIGH';
    }

    if (scalar >= 42) {
      return 'MEDIUM';
    }

    if (scalar >= 22) {
      return 'HINT';
    }

    return 'NONE';
  }

  private resolveStateBias(state: BotRuntimeState['state']): number {
    switch (state) {
      case 'ATTACKING':
        return 44;
      case 'TARGETING':
        return 28;
      case 'WATCHING':
        return 14;
      case 'NEUTRALIZED':
        return 0;
      case 'DORMANT':
      default:
        return 4;
    }
  }

  private resolveStateHeatBias(state: BotRuntimeState['state']): number {
    switch (state) {
      case 'ATTACKING':
        return 22;
      case 'TARGETING':
        return 12;
      case 'WATCHING':
        return 6;
      case 'NEUTRALIZED':
        return -20;
      case 'DORMANT':
      default:
        return 0;
    }
  }

  private resolveTempoBonus(band: BattleTempoBand): number {
    switch (band) {
      case 'OVERRUN':
        return 14;
      case 'SURGING':
        return 10;
      case 'SHARP':
        return 6;
      case 'BUILDING':
        return 3;
      case 'QUIET':
      default:
        return 0;
    }
  }

  private resolveCategoryChatWeight(category: AttackCategory): number {
    switch (category) {
      case 'BREACH':
        return 16;
      case 'EXTRACTION':
        return 14;
      case 'LOCK':
        return 12;
      case 'DRAIN':
        return 10;
      case 'HEAT':
        return 12;
      default:
        return 8;
    }
  }

  private resolveCategorySceneWeight(category: AttackCategory): number {
    switch (category) {
      case 'BREACH':
        return 18;
      case 'EXTRACTION':
        return 16;
      case 'LOCK':
        return 10;
      case 'DRAIN':
        return 12;
      case 'HEAT':
        return 14;
      default:
        return 8;
    }
  }

  private computeWeakLayerBonus(
    snapshot: RunStateSnapshot,
    profile: BotProfile,
  ): number {
    const weakest = snapshot.shield.weakestLayerId;
    const weakestRatio = snapshot.shield.weakestLayerRatio;

    if (profile.preferredLayer === 'DIRECT') {
      return clamp((1 - weakestRatio) * 20, 0, 20);
    }

    if (profile.preferredLayer === weakest) {
      return clamp((1 - weakestRatio) * 26, 0, 26);
    }

    return clamp((1 - weakestRatio) * 10, 0, 10);
  }

  private computeCooldownPressure(
    runtime: BotRuntimeState,
    profile: BotProfile,
    tick: number,
  ): number {
    if (runtime.lastAttackTick === null) {
      return 10;
    }

    const elapsed = Math.max(0, tick - runtime.lastAttackTick);
    const ratio = clamp(elapsed / Math.max(1, profile.cooldownTicks), 0, 2);

    return round2(clamp(ratio * 12, 0, 16));
  }

  private computeCoopTrustPenalty(snapshot: RunStateSnapshot): number {
    const trustScores = Object.values(snapshot.modeState.trustScores ?? {});
    if (trustScores.length === 0) {
      return 0;
    }

    const highTrustCount = trustScores.filter((value) => value >= 75).length;
    return clamp(highTrustCount * 1.8, 0, 10);
  }

  private emitAndBuildStateSignals(
    evolutions: readonly EvolvedBotEntry[],
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): readonly ReturnType<typeof createEngineSignal>[] {
    const signals: ReturnType<typeof createEngineSignal>[] = [];

    for (const entry of evolutions) {
      if (!entry.stateChanged) {
        continue;
      }

      const tags = this.compactNotes([
        entry.profile.botId,
        entry.previousState,
        entry.nextState,
        `composite:${String(entry.compositeThreat)}`,
        `threat-band:${entry.threatBand}`,
      ]);

      context.bus.emit('battle.bot.state_changed', {
        botId: entry.runtimeAfter.botId,
        from: entry.previousState,
        to: entry.nextState,
        tick: snapshot.tick,
      });

      context.bus.emit('battle.scene.candidate', {
        sceneType: 'BOT_POSTURE_SHIFT',
        botId: entry.profile.botId,
        state: entry.nextState,
        tick: snapshot.tick,
        tags,
      });

      signals.push(
        createEngineSignal(
          this.engineId,
          entry.nextState === 'ATTACKING' ? 'WARN' : 'INFO',
          'BOT_STATE_CHANGED',
          `${entry.runtimeAfter.botId} changed from ${entry.previousState} to ${entry.nextState}.`,
          snapshot.tick,
          tags,
        ),
      );
    }

    return signals;
  }

  private buildCounterIntelReveals(
    evolutions: readonly EvolvedBotEntry[],
    snapshot: RunStateSnapshot,
    modeIntel: ModeIntel,
  ): readonly CounterIntelReveal[] {
    const reveals = evolutions
      .filter((entry) => entry.counterIntelGrade !== 'NONE')
      .map((entry) => {
        const confidence = round3(
          clamp(
            entry.compositeThreat * 0.007 +
              entry.attackUrgency * 0.004 +
              modeIntel.counterIntelBias * 0.08,
            0,
            1,
          ),
        );

        return {
          botId: entry.profile.botId,
          grade: entry.counterIntelGrade,
          posture: entry.nextState,
          confidence,
          profile: {
            label: entry.profile.label,
            archetype: entry.profile.archetype,
            preferredCategory: entry.profile.preferredCategory,
            preferredLayer: entry.profile.preferredLayer,
            cooldownTicks: entry.profile.cooldownTicks,
          },
          risk: {
            pressureThreat: round2(snapshot.pressure.score * 100),
            compositeThreat: entry.compositeThreat,
            urgency: entry.attackUrgency,
          },
          notes: this.compactNotes([
            ...entry.profile.notes,
            `chat-weight:${String(entry.chatWeight)}`,
            `scene-weight:${String(entry.sceneWeight)}`,
          ]),
        };
      })
      .sort((left, right) => {
        if (left.grade !== right.grade) {
          return this.counterIntelRank(right.grade) - this.counterIntelRank(left.grade);
        }

        if (left.risk.compositeThreat !== right.risk.compositeThreat) {
          return right.risk.compositeThreat - left.risk.compositeThreat;
        }

        return stableCompare(left.botId, right.botId);
      });

    const limit = snapshot.modeState.counterIntelTier <= 0 ? 0 : 5;
    return reveals.slice(0, limit);
  }

  private emitCounterIntel(
    reveals: readonly CounterIntelReveal[],
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): void {
    for (const reveal of reveals) {
      context.bus.emit('battle.counterintel.available', {
        botId: reveal.botId,
        tier: reveal.grade,
        confidence: reveal.confidence,
        profile: reveal.profile,
        risk: reveal.risk,
        notes: reveal.notes,
        tick: snapshot.tick,
      });
    }
  }

  private counterIntelRank(grade: CounterIntelGrade): number {
    switch (grade) {
      case 'FULL':
        return 4;
      case 'HIGH':
        return 3;
      case 'MEDIUM':
        return 2;
      case 'HINT':
        return 1;
      case 'NONE':
      default:
        return 0;
    }
  }

  private buildInjectionPlan(
    evolutions: readonly EvolvedBotEntry[],
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): InjectionPlan {
    const pendingCapReached =
      snapshot.battle.pendingAttacks.length >= modeIntel.pendingAttackCap;

    const intents: AttackIntent[] = evolutions
      .map((entry) => {
        const gate = this.canInjectAttackDetailed({
          entry,
          snapshot,
          modeIntel,
          pendingCapReached,
        });

        const priority = this.computeInjectionPriority(
          entry,
          snapshot,
          heatProfile,
          modeIntel,
          gate,
        );

        return {
          entry,
          gate,
          priority,
          reservePriority: this.computeReservePriority(
            entry,
            snapshot,
            heatProfile,
            modeIntel,
          ),
          orchestrationTags: this.compactNotes([
            ...entry.notes,
            `priority:${String(priority)}`,
            `gate:${gate.reason}`,
          ]),
        };
      })
      .sort((left, right) => {
        if (left.gate.allowed !== right.gate.allowed) {
          return left.gate.allowed ? -1 : 1;
        }

        if (left.priority !== right.priority) {
          return right.priority - left.priority;
        }

        if (left.reservePriority !== right.reservePriority) {
          return right.reservePriority - left.reservePriority;
        }

        return stableCompare(left.entry.profile.botId, right.entry.profile.botId);
      });

    const allowed = intents.filter((intent) => intent.gate.allowed);
    const blocked = intents.filter((intent) => !intent.gate.allowed);

    const limit = this.resolveSimultaneousInjectionLimit(
      snapshot,
      heatProfile,
      modeIntel,
      allowed,
    );

    const selected = allowed.slice(0, limit);
    const reserved = allowed.slice(limit);

    return {
      selected,
      blocked,
      reserved,
      limit,
    };
  }

  private canInjectAttackDetailed(args: {
    readonly entry: EvolvedBotEntry;
    readonly snapshot: RunStateSnapshot;
    readonly modeIntel: ModeIntel;
    readonly pendingCapReached: boolean;
  }): InjectionGateResult {
    const { entry, snapshot, modeIntel, pendingCapReached } = args;
    const { runtimeAfter: bot, profile } = entry;

    if (bot.neutralized) {
      return {
        allowed: false,
        reason: 'BOT_NEUTRALIZED',
        detail: ['neutralized-bot', profile.botId],
      };
    }

    if (snapshot.modeState.disabledBots.includes(bot.botId)) {
      return {
        allowed: false,
        reason: 'MODE_DISABLED',
        detail: ['bot-disabled-by-mode', profile.botId],
      };
    }

    if (bot.state !== 'ATTACKING') {
      return {
        allowed: false,
        reason: 'NOT_ATTACKING',
        detail: [bot.state.toLowerCase()],
      };
    }

    if (bot.lastAttackTick !== null) {
      const elapsed = snapshot.tick - bot.lastAttackTick;
      if (elapsed < profile.cooldownTicks) {
        return {
          allowed: false,
          reason: 'ON_COOLDOWN',
          detail: [
            `elapsed:${String(elapsed)}`,
            `cooldown:${String(profile.cooldownTicks)}`,
          ],
        };
      }
    }

    if (
      snapshot.mode === 'pvp' &&
      profile.preferredCategory === 'EXTRACTION' &&
      snapshot.battle.extractionCooldownTicks > 0
    ) {
      return {
        allowed: false,
        reason: 'PVP_EXTRACTION_LOCK',
        detail: [
          `cooldown:${String(snapshot.battle.extractionCooldownTicks)}`,
          'extraction-locked',
        ],
      };
    }

    if (
      snapshot.mode === 'ghost' &&
      profile.preferredCategory === 'BREACH' &&
      snapshot.cards.ghostMarkers.length === 0
    ) {
      return {
        allowed: false,
        reason: 'GHOST_MARKER_REQUIRED',
        detail: ['ghost-marker-required'],
      };
    }

    if (pendingCapReached) {
      return {
        allowed: false,
        reason: 'PENDING_CAP_REACHED',
        detail: [
          `pending:${String(snapshot.battle.pendingAttacks.length)}`,
          `cap:${String(modeIntel.pendingAttackCap)}`,
        ],
      };
    }

    if (modeIntel.phaseRestrictionFactor < 0.8 && entry.attackUrgency < 70) {
      return {
        allowed: false,
        reason: 'MODE_PHASE_RESTRICTED',
        detail: ['phase-restricted', `factor:${String(modeIntel.phaseRestrictionFactor)}`],
      };
    }

    if (
      snapshot.pressure.score < DEFAULT_MIN_ATTACK_PRESSURE &&
      entry.compositeThreat < profile.activationThreshold
    ) {
      return {
        allowed: false,
        reason: 'PRESSURE_TOO_LOW',
        detail: [
          `pressure:${String(round3(snapshot.pressure.score))}`,
          `activation:${String(profile.activationThreshold)}`,
        ],
      };
    }

    if (
      snapshot.battle.battleBudget <= 0 &&
      snapshot.mode !== 'ghost' &&
      entry.profile.preferredCategory !== 'BREACH'
    ) {
      return {
        allowed: false,
        reason: 'BUDGET_LOCKED',
        detail: ['battle-budget-empty'],
      };
    }

    return {
      allowed: true,
      reason: 'NO_BLOCK',
      detail: ['allowed'],
    };
  }

  private computeInjectionPriority(
    entry: EvolvedBotEntry,
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
    gate: InjectionGateResult,
  ): number {
    if (!gate.allowed) {
      return -1;
    }

    const categoryBias = this.resolveCategoryPriorityBias(
      entry.profile.preferredCategory,
      snapshot.mode,
    );
    const budgetBias =
      snapshot.battle.battleBudget <= 2
        ? entry.profile.preferredCategory === 'BREACH'
          ? 10
          : 0
        : 4;

    return round2(
      clamp(
        entry.attackUrgency * 0.42 +
          entry.compositeThreat * 0.26 +
          entry.postureScore * 0.12 +
          this.resolveTempoBonus(heatProfile.tempoBand) +
          categoryBias +
          budgetBias +
          modeIntel.rivalryBias,
        0,
        100,
      ),
    );
  }

  private computeReservePriority(
    entry: EvolvedBotEntry,
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): number {
    return round2(
      clamp(
        entry.chatWeight * 0.34 +
          entry.sceneWeight * 0.24 +
          entry.compositeThreat * 0.18 +
          this.resolveTempoBonus(heatProfile.tempoBand) +
          modeIntel.chatWitnessBias,
        0,
        100,
      ),
    );
  }

  private resolveCategoryPriorityBias(
    category: AttackCategory,
    mode: ModeCode,
  ): number {
    switch (category) {
      case 'BREACH':
        return mode === 'ghost' ? 18 : 14;
      case 'EXTRACTION':
        return mode === 'pvp' ? 16 : 10;
      case 'LOCK':
        return mode === 'solo' ? 12 : 10;
      case 'DRAIN':
        return 11;
      case 'HEAT':
        return mode === 'coop' ? 13 : 9;
      default:
        return 8;
    }
  }

  private resolveSimultaneousInjectionLimit(
    snapshot: RunStateSnapshot,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
    allowed: readonly AttackIntent[],
  ): number {
    if (allowed.length === 0) {
      return 0;
    }

    let limit = modeIntel.maxSimultaneousInjections;

    if (heatProfile.tempoBand === 'QUIET') {
      limit = Math.max(1, limit - 1);
    } else if (heatProfile.tempoBand === 'OVERRUN') {
      limit = Math.min(limit + 1, 3);
    }

    if (snapshot.mode === 'ghost' && snapshot.cards.ghostMarkers.length === 0) {
      limit = Math.min(limit, 1);
    }

    if (snapshot.mode === 'pvp' && snapshot.battle.extractionCooldownTicks > 0) {
      limit = Math.min(limit, 1);
    }

    if (snapshot.mode === 'coop' && Object.keys(snapshot.modeState.trustScores ?? {}).length >= 3) {
      limit = Math.min(3, limit + 1);
    }

    if (snapshot.modeState.phaseBoundaryWindowsRemaining <= 0) {
      limit = Math.max(1, limit - 1);
    }

    return clamp(limit, 1, Math.max(1, allowed.length));
  }

  private materializeInjectedAttacks(
    selected: readonly AttackIntent[],
    snapshot: RunStateSnapshot,
    context: TickContext,
    modeIntel: ModeIntel,
  ): AttackEvent[] {
    const sorted = [...selected].sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }

      return stableCompare(left.entry.profile.botId, right.entry.profile.botId);
    });

    const attacks = sorted.map((intent, index) => {
      const attack = this.injector.create({
        runId: snapshot.runId,
        tick: snapshot.tick,
        attackIndex: index + 1,
        mode: snapshot.mode,
        profile: intent.entry.profile,
        pressureScore: snapshot.pressure.score,
        compositeThreat: intent.entry.compositeThreat,
        firstBloodClaimed: snapshot.battle.firstBloodClaimed,
      });

      const withNotes: AttackEvent = {
        ...attack,
        notes: [...this.compactNotes([
          ...(attack.notes ?? []),
          ...intent.orchestrationTags,
          `tempo:${modeIntel.notes[0] ?? 'battle-doctrine'}`,
        ])],
      };

      context.bus.emit('battle.attack.injected', { attack: withNotes });
      context.bus.emit('threat.routed', {
        threatId: withNotes.attackId,
        source: withNotes.source,
        category: withNotes.category,
        targetLayer: withNotes.targetLayer,
        targetEntity: withNotes.targetEntity,
      });

      context.bus.emit('battle.scene.candidate', {
        sceneType: 'HOSTILE_ATTACK_INJECTED',
        botId: withNotes.source,
        attackId: withNotes.attackId,
        category: withNotes.category,
        targetLayer: withNotes.targetLayer,
        tick: snapshot.tick,
        notes: withNotes.notes,
      });

      return withNotes;
    });

    return attacks;
  }

  private emitAttackAuthorityEvents(
    snapshot: RunStateSnapshot,
    context: TickContext,
    attacks: readonly AttackEvent[],
    evolutions: readonly EvolvedBotEntry[],
    projectedPressureTax: number,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): void {
    const byBot = new Map<HaterBotId, EvolvedBotEntry>(
      evolutions.map((entry) => [entry.profile.botId, entry]),
    );

    for (const attack of attacks) {
      const entry = byBot.get(attack.source as HaterBotId);
      const socialFrame = this.buildSocialPressureFrame(
        attack,
        entry,
        heatProfile,
        modeIntel,
      );

      context.bus.emit('battle.attack.authority', {
        attackId: attack.attackId,
        source: attack.source,
        category: attack.category,
        targetLayer: attack.targetLayer,
        targetEntity: attack.targetEntity,
        magnitude: attack.magnitude,
        projectedPressureTax,
        socialFrame,
        tick: snapshot.tick,
      });

      context.bus.emit('chat.event.battle.attack', {
        runId: snapshot.runId,
        tick: snapshot.tick,
        attackId: attack.attackId,
        botId: attack.source,
        category: attack.category,
        targetLayer: attack.targetLayer,
        magnitude: attack.magnitude,
        audienceHeatDelta: socialFrame.audienceHeatDelta,
        humiliationPressureDelta: socialFrame.humiliationPressureDelta,
        sceneKey: socialFrame.sceneKey,
        tags: socialFrame.tags,
      });
    }
  }

  private emitSocialPressureFrames(
    snapshot: RunStateSnapshot,
    context: TickContext,
    attacks: readonly AttackEvent[],
    evolutions: readonly EvolvedBotEntry[],
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): void {
    if (attacks.length === 0) {
      const sharpTargeting = evolutions
        .filter((entry) => entry.nextState === 'TARGETING' || entry.nextState === 'ATTACKING')
        .sort((left, right) => right.sceneWeight - left.sceneWeight)[0];

      if (!sharpTargeting) {
        return;
      }

      context.bus.emit('chat.event.battle.pressure', {
        runId: snapshot.runId,
        tick: snapshot.tick,
        pressureBand: snapshot.pressure.band,
        tempoBand: heatProfile.tempoBand,
        botId: sharpTargeting.profile.botId,
        witnessTier: sharpTargeting.sceneWeight >= 70 ? 'HIGH' : 'MEDIUM',
        sceneKey:
          snapshot.mode === 'pvp'
            ? 'BATTLE_PREDATORY_SILENCE'
            : snapshot.mode === 'ghost'
              ? 'BATTLE_HAUNTED_LOCK'
              : 'BATTLE_TARGETING_PRESSURE',
        tags: this.compactNotes([
          `bot:${sharpTargeting.profile.botId}`,
          `scene:${heatProfile.tempoBand.toLowerCase()}`,
          ...modeIntel.notes,
        ]),
      });

      return;
    }

    const socialFrames = attacks.map((attack) => {
      const entry = evolutions.find((candidate) => candidate.profile.botId === attack.source);
      return this.buildSocialPressureFrame(attack, entry, heatProfile, modeIntel);
    });

    const aggregate = socialFrames.reduce(
      (accumulator, frame) => ({
        audienceHeatDelta: accumulator.audienceHeatDelta + frame.audienceHeatDelta,
        humiliationPressureDelta:
          accumulator.humiliationPressureDelta + frame.humiliationPressureDelta,
        hypePressureDelta: accumulator.hypePressureDelta + frame.hypePressureDelta,
      }),
      {
        audienceHeatDelta: 0,
        humiliationPressureDelta: 0,
        hypePressureDelta: 0,
      },
    );

    context.bus.emit('chat.event.battle.swarm', {
      runId: snapshot.runId,
      tick: snapshot.tick,
      attackCount: attacks.length,
      tempoBand: heatProfile.tempoBand,
      audienceHeatDelta: aggregate.audienceHeatDelta,
      humiliationPressureDelta: aggregate.humiliationPressureDelta,
      hypePressureDelta: aggregate.hypePressureDelta,
      tags: this.compactNotes([
        `mode:${snapshot.mode}`,
        `count:${String(attacks.length)}`,
        `tempo:${heatProfile.tempoBand}`,
      ]),
    });
  }

  private buildSocialPressureFrame(
    attack: AttackEvent,
    entry: EvolvedBotEntry | undefined,
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): SocialPressureFrame {
    const magnitudeFactor = clamp((attack.magnitude ?? 0) / 100, 0, 1);
    const audienceHeatDelta = round2(
      clamp(
        magnitudeFactor * 14 +
          modeIntel.chatWitnessBias * 0.4 +
          this.resolveTempoBonus(heatProfile.tempoBand),
        0,
        30,
      ),
    );

    const humiliationPressureDelta = round2(
      clamp(
        magnitudeFactor * 16 +
          (attack.category === 'BREACH' ? 8 : 0) +
          (attack.category === 'EXTRACTION' ? 5 : 0) +
          (entry?.sceneWeight ?? 0) * 0.08,
        0,
        36,
      ),
    );

    const hypePressureDelta = round2(
      clamp(
        modeIntel.mode === 'pvp'
          ? magnitudeFactor * 8 + (entry?.chatWeight ?? 0) * 0.04
          : 0,
        0,
        18,
      ),
    );

    return {
      audienceHeatDelta,
      humiliationPressureDelta,
      hypePressureDelta,
      witnessTier:
        audienceHeatDelta >= 18 || humiliationPressureDelta >= 18
          ? 'HIGH'
          : audienceHeatDelta >= 10
            ? 'MEDIUM'
            : 'LOW',
      sceneKey: this.resolveSceneKeyForAttack(attack, modeIntel.mode),
      tags: this.compactNotes([
        `category:${attack.category}`,
        `target:${attack.targetLayer}`,
        `entity:${attack.targetEntity}`,
        `tempo:${heatProfile.tempoBand}`,
      ]),
    };
  }

  private resolveSceneKeyForAttack(
    attack: AttackEvent,
    mode: ModeCode,
  ): string {
    if (mode === 'pvp') {
      if (attack.category === 'EXTRACTION') {
        return 'PVP_EXTRACTION_STRIKE';
      }
      if (attack.category === 'BREACH') {
        return 'PVP_CORE_BREAK_ATTEMPT';
      }
      return 'PVP_HOSTILE_EXCHANGE';
    }

    if (mode === 'coop') {
      if (attack.category === 'HEAT') {
        return 'COOP_TRUST_DESTABILIZATION';
      }
      return 'COOP_HOSTILE_PRESSURE';
    }

    if (mode === 'ghost') {
      if (attack.category === 'BREACH') {
        return 'GHOST_LEGEND_BREACH';
      }
      return 'GHOST_PREDATOR_SURGE';
    }

    return attack.category === 'LOCK'
      ? 'SOLO_LOCKDOWN_WAVE'
      : attack.category === 'DRAIN'
        ? 'SOLO_RESOURCE_DRAIN'
        : 'SOLO_HOSTILE_PRESSURE';
  }

  private resolveBotsAfterInjection(
    evolutions: readonly EvolvedBotEntry[],
    injectedAttacks: readonly AttackEvent[],
    snapshot: RunStateSnapshot,
    modeIntel: ModeIntel,
  ): BotRuntimeState[] {
    const attackedBotIds = new Set<HaterBotId>(
      injectedAttacks.map((attack) => attack.source as HaterBotId),
    );

    return evolutions.map((entry) => {
      const didAttack = attackedBotIds.has(entry.profile.botId);
      const cooledHeat = didAttack
        ? clamp(entry.runtimeAfter.heat + 4, 0, 100)
        : this.decayBotHeat(entry.runtimeAfter.heat, snapshot.mode, modeIntel);

      return {
        ...entry.runtimeAfter,
        heat: cooledHeat,
        lastAttackTick: didAttack ? snapshot.tick : entry.runtimeAfter.lastAttackTick,
      };
    });
  }

  private decayBotHeat(
    heat: number,
    mode: ModeCode,
    modeIntel: ModeIntel,
  ): number {
    const decay =
      mode === 'coop'
        ? 3
        : mode === 'ghost'
          ? 1
          : mode === 'pvp'
            ? 2
            : 2;

    return round2(clamp(heat - decay + modeIntel.baseHeatBias * 0.06, 0, 100));
  }

  private mergePendingAttacks(
    existing: readonly AttackEvent[],
    injected: readonly AttackEvent[],
    cap: number,
  ): PendingAttackMergeResult {
    const map = new Map<string, AttackEvent>();

    const ordered = [...existing, ...injected].sort((left, right) => {
      if (left.createdAtTick !== right.createdAtTick) {
        return left.createdAtTick - right.createdAtTick;
      }

      return left.attackId.localeCompare(right.attackId);
    });

    for (const attack of ordered) {
      map.set(attack.attackId, {
        ...attack,
        notes: [...this.compactNotes(attack.notes ?? [])],
      });
    }

    const merged = Array.from(map.values());
    const hardCap = Math.max(1, cap);
    const prunedCount = Math.max(0, merged.length - hardCap);
    const pending = merged.slice(Math.max(0, merged.length - hardCap));

    return {
      pending,
      prunedCount,
    };
  }

  private resolveExtractionCooldown(
    snapshot: RunStateSnapshot,
    injected: readonly AttackEvent[],
    modeIntel: ModeIntel,
  ): number {
    if (snapshot.mode !== 'pvp') {
      return snapshot.battle.extractionCooldownTicks;
    }

    const hostileExtraction = injected.some(
      (attack) => attack.category === 'EXTRACTION',
    );

    if (!hostileExtraction) {
      return snapshot.battle.extractionCooldownTicks;
    }

    return Math.max(
      snapshot.battle.extractionCooldownTicks,
      modeIntel.extractionCooldownOnHostileFire,
    );
  }

  private resolveRivalryHeatCarry(
    snapshot: RunStateSnapshot,
    evolutions: readonly EvolvedBotEntry[],
    botsAfterInjection: readonly BotRuntimeState[],
    injected: readonly AttackEvent[],
    heatProfile: HeatProfile,
    modeIntel: ModeIntel,
  ): number {
    const decay = snapshot.mode === 'coop' ? 2 : 1;
    const decayed = Math.max(
      0,
      Math.round(snapshot.battle.rivalryHeatCarry * 0.84) - decay,
    );

    const postureContribution = botsAfterInjection.reduce((sum, bot) => {
      if (bot.state === 'WATCHING') {
        return sum + 1;
      }

      if (bot.state === 'TARGETING') {
        return sum + 3;
      }

      if (bot.state === 'ATTACKING') {
        return sum + 6;
      }

      return sum;
    }, 0);

    const injectionContribution = injected.reduce((sum, attack) => {
      if (attack.category === 'EXTRACTION') {
        return sum + 5;
      }

      if (attack.category === 'BREACH') {
        return sum + 7;
      }

      if (attack.category === 'HEAT') {
        return sum + 4;
      }

      return sum + 3;
    }, 0);

    const sceneContribution = evolutions.reduce(
      (sum, entry) => sum + Math.round(entry.sceneWeight * 0.03),
      0,
    );

    const tempoContribution = this.resolveTempoBonus(heatProfile.tempoBand);
    const modeBias =
      snapshot.mode === 'pvp'
        ? 5
        : snapshot.mode === 'ghost'
          ? 4
          : snapshot.mode === 'coop'
            ? 3
            : 2;

    return clamp(
      decayed +
        postureContribution +
        injectionContribution +
        sceneContribution +
        tempoContribution +
        modeBias +
        modeIntel.rivalryBias,
      0,
      100,
    );
  }

  private resolveSharedOpportunityCursor(
    snapshot: RunStateSnapshot,
    injected: readonly AttackEvent[],
    modeIntel: ModeIntel,
  ): number {
    if (!snapshot.modeState.sharedOpportunityDeck) {
      return snapshot.battle.sharedOpportunityDeckCursor;
    }

    const cursorDelta =
      injected.length * Math.max(1, modeIntel.opportunityCursorMultiplier);

    return snapshot.battle.sharedOpportunityDeckCursor + cursorDelta;
  }

  private resolveNeutralizedBotIds(
    botsAfterInjection: readonly BotRuntimeState[],
  ): readonly HaterBotId[] {
    return botsAfterInjection
      .filter((bot) => bot.neutralized)
      .map((bot) => bot.botId)
      .sort(stableCompare);
  }

  private emitBudgetAndDiagnostics(
    snapshot: RunStateSnapshot,
    context: TickContext,
    battleBudget: number,
    projectedPressureTax: number,
    diagnostics: BattleDiagnostics,
  ): void {
    context.bus.emit('battle.budget.updated', {
      tick: snapshot.tick,
      battleBudget,
      projectedPressureTax,
      selectedCount: diagnostics.selectedCount,
      blockedCount: diagnostics.blockedCount,
      tempoBand: diagnostics.tempoBand,
    });

    context.bus.emit('battle.diagnostics', {
      tick: snapshot.tick,
      runId: snapshot.runId,
      diagnostics,
    });
  }

  private buildResultSignals(
    snapshot: RunStateSnapshot,
    evolutions: readonly EvolvedBotEntry[],
    plan: InjectionPlan,
    injectedAttacks: readonly AttackEvent[],
    budgetNotes: readonly string[],
    counterIntel: readonly CounterIntelReveal[],
    diagnostics: BattleDiagnostics,
    prunedCount: number,
    pendingCap: number,
  ): readonly ReturnType<typeof createEngineSignal>[] {
    const signals: ReturnType<typeof createEngineSignal>[] = [];

    if (budgetNotes.length > 0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'COUNTERPLAY_BUDGET_UPDATED',
          'Battle counterplay budget adjusted by hostile injections.',
          snapshot.tick,
          this.compactNotes(budgetNotes),
        ),
      );
    }

    if (counterIntel.length > 0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'COUNTER_INTEL_AVAILABLE',
          `${counterIntel.length} counter-intel reveal(s) prepared.`,
          snapshot.tick,
          this.compactNotes(
            counterIntel.map((entry) => `${entry.botId}:${entry.grade}`),
          ),
        ),
      );
    }

    if (injectedAttacks.length > 0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          injectedAttacks.some((attack) => attack.category === 'BREACH')
            ? 'ERROR'
            : 'WARN',
          'HOSTILE_ATTACKS_INJECTED',
          `${injectedAttacks.length} hostile attack(s) injected.`,
          snapshot.tick,
          this.compactNotes([
            `count:${String(injectedAttacks.length)}`,
            `projected-pressure-tax:${String(diagnostics.projectedPressureTax)}`,
            `tempo:${diagnostics.tempoBand}`,
            `rivalry-next:${String(diagnostics.rivalryHeatNext)}`,
          ]),
        ),
      );
    }

    if (plan.blocked.length > 0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'HOSTILE_INTENTS_BLOCKED',
          `${plan.blocked.length} hostile intent(s) remained gated.`,
          snapshot.tick,
          this.buildBlockedBreakdown(plan.blocked),
        ),
      );
    }

    if (plan.reserved.length > 0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'HOSTILE_INTENTS_RESERVED',
          `${plan.reserved.length} hostile intent(s) reserved for deterministic pacing.`,
          snapshot.tick,
          this.compactNotes(
            plan.reserved.map((intent) => intent.entry.profile.botId),
          ),
        ),
      );
    }

    if (prunedCount > 0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'PENDING_ATTACKS_PRUNED',
          `${prunedCount} pending attack(s) pruned from the tail ledger cap.`,
          snapshot.tick,
          [
            `pruned:${String(prunedCount)}`,
            `cap:${String(pendingCap)}`,
          ],
        ),
      );
    }

    const attackingCount = evolutions.filter(
      (entry) => entry.nextState === 'ATTACKING',
    ).length;
    const targetingCount = evolutions.filter(
      (entry) => entry.nextState === 'TARGETING',
    ).length;

    signals.push(
      createEngineSignal(
        this.engineId,
        diagnostics.tempoBand === 'OVERRUN' ? 'WARN' : 'INFO',
        'BATTLE_DIAGNOSTICS',
        'Battle diagnostics computed for this tick.',
        snapshot.tick,
        this.compactNotes([
          `tempo:${diagnostics.tempoBand}`,
          `attacking:${String(attackingCount)}`,
          `targeting:${String(targetingCount)}`,
          `base-heat:${String(diagnostics.baseHeat.baseHeat)}`,
          `pending-tax:${String(diagnostics.projectedPressureTax)}`,
        ]),
      ),
    );

    return signals;
  }

  private buildBlockedBreakdown(
    blocked: readonly AttackIntent[],
  ): readonly string[] {
    const counts = new Map<InjectionGateReason, number>();

    for (const entry of blocked) {
      counts.set(entry.gate.reason, (counts.get(entry.gate.reason) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((left, right) => stableCompare(left[0], right[0]))
      .map(([reason, count]) => `${reason}:${String(count)}`);
  }

  private compactNotes(notes: readonly string[]): readonly string[] {
    const unique = Array.from(
      new Set(
        notes
          .map((note) => note.trim())
          .filter((note) => note.length > 0),
      ),
    );

    return unique.slice(0, MAX_SIGNAL_TAGS);
  }
}
