//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/shield/ShieldEngine.ts

/**
 * FILE: pzo-web/src/engines/shield/ShieldEngine.ts
 * Public API orchestrator for all shield operations. Implements ShieldReader.
 *
 * Public surface:
 *   applyAttack(attack)  — called per-attack from BattleEngine (via EngineOrchestrator) at Step 5
 *   queueRepair(card)    — called when CardEngine plays a repair card
 *   tickShields(tick)    — called at Step 6 of each tick (repairs → passive regen → snapshot)
 *   reset()              — resets all sub-components for new run
 *
 * ShieldReader implementation is passed to BattleEngine and PressureEngine
 * via EngineOrchestrator — never the ShieldEngine class directly.
 *
 * Density6 LLC · Point Zero One · Engine 4 of 7 · Confidential
 */
import {
  ShieldLayerId,
  ShieldLayerState,
  ShieldSnapshot,
  ShieldReader,
  AttackEvent,
  DamageResult,
  RepairCard,
  SHIELD_LAYER_ORDER,
  SHIELD_LAYER_CONFIGS,
  SHIELD_CONSTANTS,
} from './types';
import { ShieldLayerManager } from './ShieldLayerManager';
import { AttackRouter } from './AttackRouter';
import { BreachCascadeResolver } from './BreachCascadeResolver';
import { ShieldRepairQueue } from './ShieldRepairQueue';
import { ShieldUXBridge } from './ShieldUXBridge';
import type { EventBus } from '../core/EventBus';
import { EngineId, type EngineInitParams } from '../zero/types';

export class ShieldEngine implements ShieldReader {
  public readonly engineId: EngineId = EngineId.SHIELD;

  private tensionReader: any = null;
  public setTensionReader(reader: any): void { this.tensionReader = reader; }
  private readonly layerManager:   ShieldLayerManager;
  private readonly router:          AttackRouter;
  private readonly cascadeResolver: BreachCascadeResolver;
  private readonly repairQueue:     ShieldRepairQueue;
  private readonly uxBridge:        ShieldUXBridge;

  private isInBreachCascade = false;
  private lastSnapshot: ShieldSnapshot | null = null;
  private tickNumber = 0;

  constructor(eventBus: EventBus) {
    this.layerManager    = new ShieldLayerManager();
    this.router          = new AttackRouter();
    this.cascadeResolver = new BreachCascadeResolver(eventBus, this.layerManager);
    this.repairQueue     = new ShieldRepairQueue(this.layerManager);
    this.uxBridge        = new ShieldUXBridge(eventBus);
  }

  // ── Attack (Step 5) ────────────────────────────────────────────────────────

  /**
   * Process a single attack event.
   * 1. Resolve target layer via AttackRouter.
   * 2. Compute deflection (bypassed entirely for critical hits).
   * 3. Apply damage via ShieldLayerManager (no overflow bleed).
   * 4. If fresh breach: emit SHIELD_LAYER_BREACHED.
   * 5. If L4 fresh breach: set isInBreachCascade, fire BreachCascadeResolver.
   * 6. Emit SHIELD_HIT.
   * 7. Return DamageResult.
   */
  public applyAttack(attack: AttackEvent): DamageResult {
    const currentLayers = this.layerManager.getAllLayers();
    const route = this.router.resolveTarget(attack.attackType, currentLayers);
    const targetId = this.router.resolveEffectiveTarget(route, currentLayers);
    const targetLayer = this.layerManager.getLayer(targetId);

    const isFortified = this.layerManager.isFortified();

    // ✦ Self-check rule #5: isCritical bypasses computeDeflection entirely
    const deflectionRate = attack.isCritical
      ? 0
      : computeDeflection(targetLayer.integrityPct, isFortified);

    const effectiveDamage = Math.round(attack.rawPower * (1 - deflectionRate));
    const preHitIntegrity = targetLayer.currentIntegrity;

    const { newIntegrity, breachOccurred, wasAlreadyBreached } =
      this.layerManager.applyDamage(targetId, effectiveDamage, attack.tickNumber);

    // Cascade triggered only on fresh L4 breach
    const cascadeTriggered = breachOccurred && targetId === ShieldLayerId.NETWORK_CORE;

    if (breachOccurred) {
      this.uxBridge.emitLayerBreached(targetId, cascadeTriggered, attack.tickNumber);
    }

    if (cascadeTriggered) {
      this.isInBreachCascade = true;
      this.cascadeResolver.resolve(attack.tickNumber);
    }

    const result: DamageResult = {
      attackId: attack.attackId,
      targetLayerId: targetId,
      fallbackLayerId: route.fallback ?? null,
      rawPower: attack.rawPower,
      deflectionApplied: deflectionRate,
      effectiveDamage,
      preHitIntegrity,
      postHitIntegrity: newIntegrity,
      breachOccurred,
      cascadeTriggered,
      wasAlreadyBreached,
      isCriticalHit: attack.isCritical,
    };

    this.uxBridge.emitShieldHit(result, attack.tickNumber);
    return result;
  }

  // ── Repair ─────────────────────────────────────────────────────────────────

  /**
   * Queue a repair card play.
   * Returns true if queued, false if the 3-job-per-layer cap is exceeded.
   * The rejected card is NOT consumed — EngineOrchestrator emits SHIELD_REPAIR_QUEUE_FULL.
   */
  public queueRepair(card: RepairCard): boolean {
    return this.repairQueue.enqueueRepair(card) !== null;
  }

  // ── Tick Step 6 ────────────────────────────────────────────────────────────

  /**
   * ✦ Self-check rule #7: tickRepairJobs() is called BEFORE tickPassiveRegen().
   *   Repair jobs deliver pts first, then passive regen adds on top.
   *
   * Sequence:
   * 1. Active repair jobs deliver pts → emit SHIELD_REPAIR for non-zero deliveries.
   * 2. Passive regen ticks for all layers.
   * 3. Fortified check → emit SHIELD_FORTIFIED if newly entering fortified state.
   * 4. Build and emit ShieldSnapshot.
   * 5. Reset isInBreachCascade per-tick flag.
   */
  public tickShields(currentTick: number): ShieldSnapshot {
    this.tickNumber = currentTick;

    // 1. Active repair jobs
    const repairResult = this.repairQueue.tickRepairJobs();
    for (const [layerId, pts] of repairResult.ptsDeliveredByLayer) {
      if (pts > 0) {
        const l = this.layerManager.getLayer(layerId);
        this.uxBridge.emitRepair(
          layerId,
          pts,
          l.currentIntegrity,
          SHIELD_LAYER_CONFIGS[layerId].maxIntegrity,
          currentTick,
        );
      }
    }

    // 2. Passive regen (clears justBreachedThisTick internally)
    this.layerManager.tickPassiveRegen();

    // 3. Fortified check (single-fire guard inside uxBridge)
    this.uxBridge.emitFortifiedIfNew(this.layerManager.isFortified(), currentTick);

    // 4. Snapshot
    const snapshot = this.buildSnapshot(currentTick);
    this.lastSnapshot = snapshot;
    this.uxBridge.emitSnapshotUpdated(snapshot, currentTick);

    // 5. Reset per-tick cascade flag
    this.isInBreachCascade = false;

    return snapshot;
  }

  // ── ShieldReader Interface ─────────────────────────────────────────────────

  public getLayerState(id: ShieldLayerId): ShieldLayerState {
    return this.layerManager.getLayer(id);
  }

  public getOverallIntegrityPct(): number {
    return this.layerManager.getOverallIntegrityPct();
  }

  public getWeakestLayerId(): ShieldLayerId {
    return this.layerManager.getWeakestLayerId();
  }

  public isFortified(): boolean {
    return this.layerManager.isFortified();
  }

  public isLayerBreached(id: ShieldLayerId): boolean {
    return this.layerManager.getLayer(id).isBreached;
  }

  public getSnapshot(): ShieldSnapshot {
    return this.lastSnapshot ?? this.buildSnapshot(this.tickNumber);
  }

  // ── Admin / Test ───────────────────────────────────────────────────────────

  /**
   * ⚠ Admin/test only. Never call during gameplay.
   * Forces a specific layer to a precise integrity value.
   */
  public forceLayerIntegrity(id: ShieldLayerId, integrity: number): void {
    const l = this.layerManager.getLayer(id);
    const cfg = SHIELD_LAYER_CONFIGS[id];
    const clamped = Math.max(0, Math.min(cfg.maxIntegrity, integrity));
    if (clamped >= l.currentIntegrity) {
      this.layerManager.applyRepair(id, clamped - l.currentIntegrity);
    } else {
      this.layerManager.applyDamage(id, l.currentIntegrity - clamped, this.tickNumber);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  /**
   * ✦ Self-check rule #9: reset() calls reset() on ALL four sub-components.
   */
  public init(params: EngineInitParams): void {
    this.reset();
  }


  public reset(): void {
    this.layerManager.reset();
    this.repairQueue.reset();
    this.cascadeResolver.reset();
    this.uxBridge.reset();
    this.isInBreachCascade = false;
    this.lastSnapshot = null;
    this.tickNumber = 0;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private buildSnapshot(tick: number): ShieldSnapshot {
    const ls = this.layerManager.getAllLayers();
    const layers = Object.fromEntries(ls.map(l => [l.id, l])) as Record<
      ShieldLayerId,
      ShieldLayerState
    >;

    return {
      layers: Object.freeze(layers),
      overallIntegrityPct: this.layerManager.getOverallIntegrityPct(),
      weakestLayerId: this.layerManager.getWeakestLayerId(),
      isFortified: this.layerManager.isFortified(),
      isInBreachCascade: this.isInBreachCascade,
      cascadeCount: this.cascadeResolver.getCascadeCount(),
      tickNumber: tick,
      timestamp: Date.now(),
    };
  }
}

// ── Deflection Formula (module-private) ────────────────────────────────────────
//
// Scales linearly from 10% at full integrity to 0% at 50%.
// Below 50%: no deflection.
// Fortified bonus (+15%) stacks on top, hard cap 25%.
//
// At 100% integrity:  base = 0.10
// At  75% integrity:  base = (0.75-0.5) * 0.20 = 0.05
// At  50% integrity:  base = (0.50-0.5) * 0.20 = 0.00
// At  25% integrity:  base = 0 (below threshold)
// Fortified at 100%:  0.10 + 0.15 = 0.25 (capped)
//
// ✦ isCritical bypass is handled in applyAttack() — this fn is never called for criticals.

function computeDeflection(integrityPct: number, isFortified: boolean): number {
  const base =
    integrityPct >= 1.0 ? SHIELD_CONSTANTS.DEFLECTION_FULL_INTEGRITY
    : integrityPct >= 0.5 ? (integrityPct - 0.5) * 0.20
    : 0;

  const bonus = isFortified ? SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT : 0;
  return Math.min(base + bonus, SHIELD_CONSTANTS.DEFLECTION_MAX);
}