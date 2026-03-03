/**
 * FILE: pzo-web/src/engines/cascade/CascadeUXBridge.ts
 *
 * The ONLY outbound EventBus channel for all cascade events.
 * Every EventBus.emit() call for cascade events lives here — zero elsewhere.
 *
 * CANONICAL BUS: zero/EventBus. Imports EventBus from '../zero/EventBus' only.
 * NEVER imports from core/EventBus or uses PZOEventChannel enum.
 *
 * Rules:
 *   ✦ Zero calculation logic. Zero game state reads. Pure emit wrapping only.
 *   ✦ Payload fields match EngineEventPayloadMap in zero/types.ts exactly.
 *   ✦ eventType, tickIndex, timestamp are in the EngineEvent ENVELOPE — not payload.
 *   ✦ BotId is imported as a TYPE only — never as a value (avoids battle dep).
 *   ✦ Must NEVER import: any engine class, any store, any hook.
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import type {
  ChainId,
  CascadeSeverity,
  CascadeDirection,
  CascadeEffectType,
  CascadeEffectPayload,
  CascadeSnapshot,
} from './types';
import type { CascadeEffect } from '../zero/types';
import type { BotId } from '../battle/types';
import type { EventBus } from '../zero/EventBus';

export class CascadeUXBridge {
  constructor(private readonly eventBus: EventBus) {}

  // ── Negative Chain Events ─────────────────────────────────────────────────

  /**
   * Fires when a new negative chain instance is created from a trigger event.
   * Payload: { pchainId → chainId, instanceId, severity } — matches
   * EngineEventPayloadMap['CASCADE_CHAIN_TRIGGERED'].
   */
  public emitChainStarted(
    chainId:    ChainId,
    instanceId: string,
    severity:   CascadeSeverity,
  ): void {
    this.eventBus.emit('CASCADE_CHAIN_TRIGGERED', {
      chainId:    chainId as string,
      instanceId,
      severity:   severity as string,
    });
  }

  /**
   * Fires when a cascade link executes (was NOT intercepted).
   * Payload: { chainId, instanceId, linkIndex, effect: CascadeEffect } — matches
   * EngineEventPayloadMap['CASCADE_LINK_FIRED'] in zero/types.ts.
   *
   * FIX TS2740: The bus expects effect: CascadeEffect (envelope from zero/types),
   * not CascadeEffectPayload (the inner payload shape from cascade/types).
   * We accept effectType + tickIndex here and construct the full envelope,
   * placing CascadeEffectPayload in effect.payload as intended.
   */
  public emitLinkFired(
    chainId:    ChainId,
    instanceId: string,
    linkIndex:  number,
    effect:     CascadeEffectPayload,
    effectType: CascadeEffectType,
    tickIndex:  number,
  ): void {
    const cascadeEffect: CascadeEffect = {
      chainId:    chainId as string,
      instanceId,
      linkIndex,
      effectType: effectType as string,
      payload:    effect,
      tickFired:  tickIndex,
    };
    this.eventBus.emit('CASCADE_LINK_FIRED', {
      chainId:    chainId as string,
      instanceId,
      linkIndex,
      effect:     cascadeEffect,
    });
  }

  /**
   * Fires when recovery intercepts a chain — remaining interceptable links are skipped.
   * Payload: { chainId, instanceId, recoveryCard, linksSkipped } — matches
   * EngineEventPayloadMap['CASCADE_CHAIN_BROKEN'].
   */
  public emitChainBroken(
    chainId:           ChainId,
    instanceId:        string,
    recoveryCard:      string,
    linksSkipped:      number,
  ): void {
    this.eventBus.emit('CASCADE_CHAIN_BROKEN', {
      chainId:      chainId as string,
      instanceId,
      recoveryCard,
      linksSkipped,
    });
  }

  /**
   * Fires when all links in a chain instance are FIRED or SKIPPED.
   * Payload: { chainId, instanceId, allLinksResolved } — matches
   * EngineEventPayloadMap['CASCADE_CHAIN_COMPLETED'].
   */
  public emitChainCompleted(
    chainId:          ChainId,
    instanceId:       string,
    allLinksResolved: boolean,
  ): void {
    this.eventBus.emit('CASCADE_CHAIN_COMPLETED', {
      chainId:          chainId as string,
      instanceId,
      allLinksResolved,
    });
  }

  // ── Positive Cascade Events ───────────────────────────────────────────────

  /**
   * Fires when a positive cascade activates or a one-time event fires.
   * Registered event: CASCADE_POSITIVE_ACTIVATED.
   */
  public emitPositiveActivated(
    pchainId:          ChainId,
    chainName:         string,
    effectDescription: string,
  ): void {
    this.eventBus.emit('CASCADE_POSITIVE_ACTIVATED', {
      pchainId:          pchainId as string,
      chainName,
      effectDescription,
    });
  }

  /**
   * Fires when a sustained positive cascade dissolves (conditions no longer met).
   * Registered event: CASCADE_POSITIVE_DISSOLVED.
   */
  public emitPositiveDissolved(
    pchainId:          ChainId,
    dissolutionReason: string,
  ): void {
    this.eventBus.emit('CASCADE_POSITIVE_DISSOLVED', {
      pchainId:          pchainId as string,
      dissolutionReason,
    });
  }

  /**
   * Fires when a positive cascade pauses (e.g. PCHAIN_FORTIFIED_SHIELDS).
   * Registered event: CASCADE_POSITIVE_PAUSED.
   */
  public emitPositivePaused(
    pchainId:    ChainId,
    pauseReason: string,
  ): void {
    this.eventBus.emit('CASCADE_POSITIVE_PAUSED', {
      pchainId:    pchainId as string,
      pauseReason,
    });
  }

  /**
   * Fires when a paused positive cascade resumes.
   * Registered event: CASCADE_POSITIVE_RESUMED.
   */
  public emitPositiveResumed(pchainId: ChainId): void {
    this.eventBus.emit('CASCADE_POSITIVE_RESUMED', {
      pchainId: pchainId as string,
    });
  }

  // ── Nemesis & Heat Events ─────────────────────────────────────────────────

  /**
   * Fires when PCHAIN_NEMESIS_BROKEN one-time event triggers for a specific bot.
   * Registered event: NEMESIS_BROKEN.
   */
  public emitNemesisBroken(
    botId:         BotId,
    immunityTicks: number,
  ): void {
    this.eventBus.emit('NEMESIS_BROKEN', {
      botId:          botId as string,
      haterHeatReset: true,
      immunityTicks,
    });
  }

  /**
   * Queues a hater_heat DB write delta via EngineOrchestrator.
   * CascadeEngine never writes directly to DB — it queues the delta.
   * Registered event: HATER_HEAT_WRITE_QUEUED.
   */
  public emitHeatWriteQueued(
    delta:         number,
    sourceChainId: ChainId,
  ): void {
    this.eventBus.emit('HATER_HEAT_WRITE_QUEUED', {
      delta,
      sourceChainId: sourceChainId as string,
    });
  }

  /**
   * Analytics event — fires when a chain trigger is silently dropped due to instance cap.
   * Registered event: CASCADE_TRIGGER_CAPPED.
   */
  public emitTriggerCapped(
    chainId:              ChainId,
    currentInstanceCount: number,
  ): void {
    this.eventBus.emit('CASCADE_TRIGGER_CAPPED', {
      chainId:              chainId as string,
      currentInstanceCount,
    });
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /**
   * Primary per-tick emit. Fires every tick after all link processing.
   * Payload: { snapshot } — opaque to zero/types.ts, typed in cascade/types.ts.
   */
  public emitSnapshotUpdated(snapshot: CascadeSnapshot): void {
    this.eventBus.emit('CASCADE_SNAPSHOT_UPDATED', { snapshot });
  }
}