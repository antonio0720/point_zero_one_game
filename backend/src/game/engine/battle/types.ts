/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/types.ts
 *
 * Doctrine:
 * - battle engine types must remain backend-authoritative and serialization-safe
 * - profiles are static doctrine; runtime bot state lives in RunStateSnapshot
 * - pressure is semantic and normalized, heat is tactical and 0..100 scaled
 */

import type {
  AttackCategory,
  AttackEvent,
  AttackTargetEntity,
  HaterBotId,
  ModeCode,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { BotRuntimeState } from '../core/RunStateSnapshot';

export interface BotProfile {
  readonly botId: HaterBotId;
  readonly label: string;
  readonly archetype: string;

  /**
   * Threat gate on a 0..100 tactical scale.
   */
  readonly activationThreshold: number;

  /**
   * Additional room above activationThreshold before the bot escalates.
   */
  readonly watchWindow: number;
  readonly targetWindow: number;

  /**
   * Higher values produce stronger attacks.
   */
  readonly aggression: number;

  readonly preferredCategory: AttackCategory;
  readonly preferredLayer: ShieldLayerId | 'DIRECT';
  readonly preferredTargetEntity: AttackTargetEntity;

  /**
   * Minimum ticks between injections for the same bot.
   */
  readonly cooldownTicks: number;

  /**
   * Weights used to translate normalized pressure and ambient heat into a
   * 0..100 composite threat score.
   */
  readonly pressureWeight: number;
  readonly heatWeight: number;
  readonly rivalryWeight: number;

  /**
   * Mode-specific bias, additive on the 0..100 tactical scale.
   */
  readonly modeWeight: Readonly<Record<ModeCode, number>>;

  readonly notes: readonly string[];
}

export interface BotEvolveInput {
  readonly baseHeat: number;
  readonly pressureScore: number;
  readonly rivalryHeatCarry: number;
  readonly mode: ModeCode;
  readonly tick: number;
}

export interface BotEvolveResult {
  readonly runtime: BotRuntimeState;
  readonly previousState: BotRuntimeState['state'];
  readonly nextState: BotRuntimeState['state'];
  readonly stateChanged: boolean;
  readonly compositeThreat: number;
}

export interface AttackBuildInput {
  readonly runId: string;
  readonly tick: number;
  readonly attackIndex: number;
  readonly mode: ModeCode;
  readonly profile: BotProfile;
  readonly pressureScore: number;
  readonly compositeThreat: number;
  readonly firstBloodClaimed: boolean;
}

export interface BudgetResolutionInput {
  readonly current: number;
  readonly cap: number;
  readonly mode: ModeCode;
  readonly injectedAttacks: readonly AttackEvent[];
  readonly firstBloodClaimed: boolean;
}

export interface BudgetResolution {
  readonly battleBudget: number;
  readonly firstBloodClaimed: boolean;
  readonly notes: readonly string[];
}