/**
 * FILE: pzo-web/src/engines/cascade/CascadeQueueManager.ts
 *
 * Owns the active CascadeChainInstance queue. Handles:
 *   ✦ Chain activation (instance cap enforcement, CATASTROPHIC acceleration logic)
 *   ✦ Per-tick link scheduling and due-link collection
 *   ✦ Severity-sorted execution (CATASTROPHIC first, MILD last)
 *   ✦ Simultaneous link cap + deferral (max 5 links per tick)
 *   ✦ Recovery interception per-link, per-instance
 *   ✦ Instance lifecycle: QUEUED → ACTIVE → INTERRUPTED → COMPLETED → DISSOLVED
 *
 * May import: types.ts, RecoveryConditionChecker.ts
 * Must NEVER import: any engine class or runtime module
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import { v4 as uuidv4 } from 'uuid';
import {
  CascadeChainDefinition,
  CascadeChainInstance,
  CascadeLinkRuntime,
  ChainInstanceStatus,
  LinkStatus,
  CascadeEffectType,
  CascadeEffectPayload,
  RecoveryActionLog,
  CascadeSeverity,
  CASCADE_CONSTANTS,
} from './types';
import { RecoveryConditionChecker } from './RecoveryConditionChecker';

// ── Result Types ───────────────────────────────────────────────────────────────

export interface LinkExecutionResult {
  instanceId:      string;
  chainId:         string;
  chainName:       string;
  severity:        CascadeSeverity;
  linkIndex:       number;
  effectType:      CascadeEffectType;
  payload:         CascadeEffectPayload;
  linkDescription: string;
  wasIntercepted:  boolean;
  recoveryMessage: string;
}

export interface TickExecutionResult {
  linksExecuted:     LinkExecutionResult[];
  chainsInterrupted: Array<{ instanceId: string; chainId: string; recoveryMessage: string; brokenAtLinkIndex: number }>;
  chainsCompleted:   Array<{ instanceId: string; chainId: string; linksFireCount: number; linksSkippedCount: number }>;
  linksDeferred:     number;
}

export class CascadeQueueManager {
  private queue:   CascadeChainInstance[] = [];
  private checker: RecoveryConditionChecker;

  constructor(shieldReader: any) {
    this.checker = new RecoveryConditionChecker(shieldReader);
  }

  // ── Chain Activation ───────────────────────────────────────────────────────

  /**
   * Creates and enqueues a new CascadeChainInstance from a trigger event.
   *
   * CATASTROPHIC chain special rule:
   *   If an instance already exists, do NOT create a second one.
   *   Instead, accelerate all PENDING links in the existing instance by -1 tick.
   *   Returns null in both the cap and CATASTROPHIC acceleration cases.
   *
   * Standard chains:
   *   If activeCount >= maxActiveInstances, return null (silently dropped).
   *   Otherwise, create and enqueue the new instance.
   */
  public activateChain(
    chainDef:         CascadeChainDefinition,
    triggerEventType: string,
    currentTick:      number
  ): CascadeChainInstance | null {
    const activeInstances = this.queue.filter(
      i => i.chainId === chainDef.chainId &&
          (i.status === ChainInstanceStatus.QUEUED || i.status === ChainInstanceStatus.ACTIVE)
    );

    // CATASTROPHIC: accelerate existing instance instead of stacking
    if (chainDef.severity === CascadeSeverity.CATASTROPHIC && activeInstances.length >= 1) {
      const existing = activeInstances[0];
      for (const link of existing.links) {
        if (link.status === LinkStatus.PENDING) {
          link.scheduledTick = Math.max(currentTick, link.scheduledTick - 1);
        }
      }
      return null;
    }

    // Standard cap enforcement
    if (activeInstances.length >= chainDef.maxActiveInstances) {
      return null;
    }

    // Build link runtimes from definition
    const links: CascadeLinkRuntime[] = chainDef.links.map(linkDef => ({
      linkDef,
      scheduledTick: currentTick + linkDef.tickOffset,
      status:        LinkStatus.PENDING,
    }));

    const instance: CascadeChainInstance = {
      instanceId:             uuidv4(),
      chainId:                chainDef.chainId,
      chainDef,
      status:                 ChainInstanceStatus.QUEUED,
      triggeredAtTick:        currentTick,
      triggerEventType,
      links,
      linksFireCount:         0,
      linksSkippedCount:      0,
      recoveryAchievedAtTick: null,
      recoveryType:           null,
    };

    this.queue.push(instance);
    return instance;
  }

  // ── Tick Execution ─────────────────────────────────────────────────────────

  /**
   * Main per-tick processing. Called at Step 7 of the tick sequence (after positive eval).
   *
   * Execution order:
   *   1. Collect all PENDING links with scheduledTick <= currentTick
   *   2. Sort: severity DESC, linkIndex ASC within same severity
   *   3. Enforce simultaneous cap (max 5) — defer excess by +1 tick
   *   4. Per link: check recovery → intercept or execute
   *   5. Mark completed instances, clean queue
   */
  public processTickLinks(
    currentTick:  number,
    recoveryLog:  RecoveryActionLog,
    runState:     any
  ): TickExecutionResult {
    const result: TickExecutionResult = {
      linksExecuted:     [],
      chainsInterrupted: [],
      chainsCompleted:   [],
      linksDeferred:     0,
    };

    // Step 1: Collect due links
    type DueEntry = { instance: CascadeChainInstance; link: CascadeLinkRuntime };
    const due: DueEntry[] = [];

    for (const instance of this.queue) {
      if (
        instance.status === ChainInstanceStatus.COMPLETED ||
        instance.status === ChainInstanceStatus.DISSOLVED
      ) continue;

      for (const link of instance.links) {
        if (link.status === LinkStatus.PENDING && link.scheduledTick <= currentTick) {
          due.push({ instance, link });
        }
      }
    }

    // Step 2: Sort — severity DESC, linkIndex ASC
    const sevOrder = CASCADE_CONSTANTS.SEVERITY_SORT_ORDER;
    due.sort((a, b) => {
      const sa = sevOrder[a.instance.chainDef.severity] ?? 4;
      const sb = sevOrder[b.instance.chainDef.severity] ?? 4;
      if (sa !== sb) return sa - sb;
      return a.link.linkDef.linkIndex - b.link.linkDef.linkIndex;
    });

    // Step 3: Simultaneous cap — defer excess
    if (due.length > CASCADE_CONSTANTS.MAX_SIMULTANEOUS_LINKS_PER_TICK) {
      const excess = due.splice(CASCADE_CONSTANTS.MAX_SIMULTANEOUS_LINKS_PER_TICK);
      for (const { link } of excess) {
        link.scheduledTick = currentTick + 1;
        // Remains PENDING — will be picked up next tick
        result.linksDeferred++;
      }
    }

    // Step 4: Execute or intercept each due link
    for (const { instance, link } of due) {
      const recovered = this.checker.isRecovered(instance, currentTick, recoveryLog, runState);

      if (recovered && link.linkDef.canBeIntercepted) {
        // Intercept: skip this link + all remaining interceptable links in this instance
        const brokenAtLinkIndex = link.linkDef.linkIndex;

        link.status = LinkStatus.SKIPPED;
        instance.linksSkippedCount++;

        // Skip all remaining interceptable PENDING links in this instance
        for (const remaining of instance.links) {
          if (
            remaining.status === LinkStatus.PENDING &&
            remaining.linkDef.canBeIntercepted &&
            remaining.linkDef.linkIndex > brokenAtLinkIndex
          ) {
            remaining.status = LinkStatus.SKIPPED;
            instance.linksSkippedCount++;
          }
        }

        // Transition to INTERRUPTED only once
        if (instance.status !== ChainInstanceStatus.INTERRUPTED) {
          instance.status                  = ChainInstanceStatus.INTERRUPTED;
          instance.recoveryAchievedAtTick  = currentTick;
          instance.recoveryType            = 'RECOVERY_CONDITION_MET';

          result.chainsInterrupted.push({
            instanceId:        instance.instanceId,
            chainId:           instance.chainId,
            recoveryMessage:   instance.chainDef.recoveryMessage,
            brokenAtLinkIndex,
          });
        }

        result.linksExecuted.push({
          instanceId:      instance.instanceId,
          chainId:         instance.chainId,
          chainName:       instance.chainDef.chainName,
          severity:        instance.chainDef.severity,
          linkIndex:       link.linkDef.linkIndex,
          effectType:      link.linkDef.effectType,
          payload:         link.linkDef.payload,
          linkDescription: link.linkDef.linkDescription,
          wasIntercepted:  true,
          recoveryMessage: instance.chainDef.recoveryMessage,
        });

        continue;
      }

      // Execute: fire the link
      link.status       = LinkStatus.FIRED;
      link.firedAtTick  = currentTick;
      instance.linksFireCount++;

      // Transition QUEUED → ACTIVE on first fired link
      if (instance.status === ChainInstanceStatus.QUEUED) {
        instance.status = ChainInstanceStatus.ACTIVE;
      }

      result.linksExecuted.push({
        instanceId:      instance.instanceId,
        chainId:         instance.chainId,
        chainName:       instance.chainDef.chainName,
        severity:        instance.chainDef.severity,
        linkIndex:       link.linkDef.linkIndex,
        effectType:      link.linkDef.effectType,
        payload:         link.linkDef.payload,
        linkDescription: link.linkDef.linkDescription,
        wasIntercepted:  false,
        recoveryMessage: '',
      });
    }

    // Step 5: Finalize — mark completed instances
    for (const instance of this.queue) {
      if (
        instance.status === ChainInstanceStatus.COMPLETED ||
        instance.status === ChainInstanceStatus.DISSOLVED
      ) continue;

      const allDone = instance.links.every(
        l => l.status === LinkStatus.FIRED || l.status === LinkStatus.SKIPPED
      );

      if (allDone) {
        instance.status = ChainInstanceStatus.COMPLETED;
        result.chainsCompleted.push({
          instanceId:       instance.instanceId,
          chainId:          instance.chainId,
          linksFireCount:   instance.linksFireCount,
          linksSkippedCount:instance.linksSkippedCount,
        });
      }
    }

    // Clean queue — remove COMPLETED and DISSOLVED
    this.queue = this.queue.filter(
      i => i.status !== ChainInstanceStatus.COMPLETED &&
           i.status !== ChainInstanceStatus.DISSOLVED
    );

    return result;
  }

  // ── Dissolution ────────────────────────────────────────────────────────────

  /**
   * Force-dissolves all active instances triggered by the given event type.
   * Used by NEMESIS_BROKEN to clear bot-related chains instantly.
   * Dissolution is synchronous — happens same tick as the event.
   */
  public dissolveChainsByTrigger(triggerEventType: string): void {
    for (const instance of this.queue) {
      if (
        instance.triggerEventType === triggerEventType &&
        instance.status !== ChainInstanceStatus.COMPLETED &&
        instance.status !== ChainInstanceStatus.DISSOLVED
      ) {
        instance.status = ChainInstanceStatus.DISSOLVED;
      }
    }
    this.queue = this.queue.filter(i => i.status !== ChainInstanceStatus.DISSOLVED);
  }

  /**
   * Force-dissolves ALL active instances.
   * Called on run reset.
   */
  public dissolveAll(): void {
    this.queue = [];
  }

  // ── Momentum Lock ──────────────────────────────────────────────────────────

  /**
   * Checks if a positive chain is currently blocked by a MOMENTUM_LOCK link.
   * CascadeEngine uses this in PositiveCascadeTracker evaluation.
   */
  public isMomentumLocked(targetChainId: string): boolean {
    // MOMENTUM_LOCK effects are applied via EventBus — this is a state query
    // for any fired MOMENTUM_LOCK links that are still within their durationTicks window.
    // Actual tracking happens in PositiveCascadeTracker via event subscription.
    // This method is a placeholder for direct queue inspection if needed.
    return false;
  }

  // ── Query Accessors ────────────────────────────────────────────────────────

  public getActiveInstances(): CascadeChainInstance[] {
    return this.queue.filter(
      i => i.status === ChainInstanceStatus.QUEUED || i.status === ChainInstanceStatus.ACTIVE
    );
  }

  public getAllInstances(): CascadeChainInstance[] {
    return [...this.queue];
  }

  public getHighestSeverity(): CascadeSeverity | null {
    const active = this.getActiveInstances();
    for (const severity of [
      CascadeSeverity.CATASTROPHIC,
      CascadeSeverity.SEVERE,
      CascadeSeverity.MODERATE,
      CascadeSeverity.MILD,
    ] as CascadeSeverity[]) {
      if (active.some(i => i.chainDef.severity === severity)) return severity;
    }
    return null;
  }

  public hasCatastrophicChain(): boolean {
    return this.getActiveInstances().some(
      i => i.chainDef.severity === CascadeSeverity.CATASTROPHIC
    );
  }

  public getActiveInstanceCount(): number {
    return this.getActiveInstances().length;
  }

  public reset(): void {
    this.queue = [];
    this.checker.reset();
  }
}