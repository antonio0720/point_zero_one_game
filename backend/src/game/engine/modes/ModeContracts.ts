/*
 * POINT ZERO ONE — BACKEND ENGINE MODE CONTRACTS
 * /backend/src/game/engine/modes/ModeContracts.ts
 *
 * Doctrine:
 * - engine-path modes must do more than decorate the initial snapshot
 * - mode logic must remain deterministic and serialization-safe
 * - solo / pvp / coop / ghost each need their own authoritative rules
 * - hooks are optional so current callers do not break
 */

import type {
  HaterBotId,
  LegendMarker,
  ModeCode,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export type TeamRoleId =
  | 'INCOME_BUILDER'
  | 'SHIELD_ARCHITECT'
  | 'OPPORTUNITY_HUNTER'
  | 'COUNTER_INTEL';

export type SoloAdvantageId =
  | 'MOMENTUM_CAPITAL'
  | 'NETWORK_ACTIVATED'
  | 'FORECLOSURE_BLOCK'
  | 'INTEL_PASS'
  | 'PHANTOM_SEED'
  | 'DEBT_SHIELD';

export type SoloHandicapId =
  | 'NO_CREDIT_HISTORY'
  | 'SINGLE_INCOME'
  | 'TARGETED'
  | 'CASH_POOR'
  | 'CLOCK_CURSED'
  | 'DISADVANTAGE_DRAFT';

export type ModeActionId =
  | 'USE_HOLD'
  | 'FIRE_EXTRACTION'
  | 'COUNTER_PLAY'
  | 'CLAIM_FIRST_BLOOD'
  | 'REQUEST_TREASURY_LOAN'
  | 'ABSORB_CASCADE'
  | 'ADVANCE_DEFECTION'
  | 'LOCK_GHOST_WINDOW';

export interface ModeConfigureOptions {
  readonly advantageId?: SoloAdvantageId | null;
  readonly handicapIds?: readonly SoloHandicapId[];
  readonly disabledBots?: readonly HaterBotId[];
  readonly bleedMode?: boolean;

  readonly teammateUserIds?: readonly string[];
  readonly roleAssignments?: Readonly<Record<string, TeamRoleId>>;
  readonly initialTrustScore?: number;
  readonly sharedTreasuryStart?: number;

  readonly battleBudgetStart?: number;
  readonly rivalryHeatCarry?: number;
  readonly spectatorLimit?: number;

  readonly legendRunId?: string | null;
  readonly legendOwnerUserId?: string | null;
  readonly legendMarkers?: readonly LegendMarker[];
  readonly legendOriginalHeat?: number;
  readonly communityRunsSinceLegend?: number;
  readonly legendDaysAlive?: number;
  readonly legendCordScore?: number | null;
}

export interface ModeAdapter {
  readonly modeCode: ModeCode;

  /**
   * One-time bootstrap before the run starts.
   */
  configure(
    snapshot: RunStateSnapshot,
    options?: ModeConfigureOptions,
  ): RunStateSnapshot;

  /**
   * Deterministic pre-engine-step mode hook.
   */
  onTickStart?(snapshot: RunStateSnapshot): RunStateSnapshot;

  /**
   * Deterministic post-engine-step mode hook.
   */
  onTickEnd?(snapshot: RunStateSnapshot): RunStateSnapshot;

  /**
   * Mode-native named actions.
   */
  resolveAction?(
    snapshot: RunStateSnapshot,
    actionId: ModeActionId,
    payload?: Readonly<Record<string, unknown>>,
  ): RunStateSnapshot;

  /**
   * End-of-run score / badge reconciliation.
   */
  finalize?(snapshot: RunStateSnapshot): RunStateSnapshot;
}