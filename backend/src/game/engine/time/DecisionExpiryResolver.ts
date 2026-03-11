/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/DecisionExpiryResolver.ts
 *
 * Doctrine:
 * - backend determines expiry consequences, not the UI
 * - "worst option" is resolved at registration time and remains immutable
 * - expiry resolution is deterministic, replay-safe, and side-effect free
 * - this file resolves choices and records metadata; it does not mutate card state
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export type DecisionCardType =
  | 'FORCED_FATE'
  | 'HATER_INJECTION'
  | 'CRISIS_EVENT'
  | string;

export interface DecisionOptionDescriptor {
  readonly index: number;
  readonly isWorst?: boolean;
  readonly cashflowDelta?: number;
  readonly netWorthDelta?: number;
  readonly tags?: readonly string[];
}

export interface RegisteredDecisionWindow {
  readonly windowId: string;
  readonly cardId: string;
  readonly actorId: string;
  readonly cardType: DecisionCardType;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly durationMs: number;
  readonly worstOptionIndex: number;
  readonly optionCount: number;
  readonly tags: readonly string[];
}

export interface DecisionWindowRegistration {
  readonly windowId: string;
  readonly cardId: string;
  readonly actorId?: string;
  readonly cardType: DecisionCardType;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly durationMs: number;
  readonly options: readonly DecisionOptionDescriptor[];
  readonly tags?: readonly string[];
}

export interface ExpiredDecisionOutcome {
  readonly windowId: string;
  readonly cardId: string;
  readonly actorId: string;
  readonly cardType: DecisionCardType;
  readonly selectedOptionIndex: number;
  readonly reason: 'EXPIRED';
  readonly openedAtTick: number;
  readonly expiredAtTick: number;
  readonly openedAtMs: number;
  readonly expiredAtMs: number;
  readonly durationMs: number;
  readonly latencyMs: number;
  readonly tags: readonly string[];
}

export interface DecisionExpiryBatchResult {
  readonly outcomes: readonly ExpiredDecisionOutcome[];
  readonly unresolvedWindowIds: readonly string[];
  readonly generatedTags: readonly string[];
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function dedupeTags(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  const merged = new Set<string>();

  for (const group of groups) {
    for (const item of group) {
      if (item.length > 0) {
        merged.add(item);
      }
    }
  }

  return freezeArray([...merged]);
}

function normalizeActorId(actorId: string | undefined, snapshot: RunStateSnapshot): string {
  return actorId && actorId.length > 0 ? actorId : snapshot.userId;
}

function resolveWorstOptionIndex(options: readonly DecisionOptionDescriptor[]): number {
  if (options.length === 0) {
    return -1;
  }

  const flagged = options.find((option) => option.isWorst === true);
  if (flagged !== undefined) {
    return flagged.index;
  }

  const sorted = [...options].sort((left, right) => {
    const leftCashflow = left.cashflowDelta ?? 0;
    const rightCashflow = right.cashflowDelta ?? 0;
    if (leftCashflow !== rightCashflow) {
      return leftCashflow - rightCashflow;
    }

    const leftNetWorth = left.netWorthDelta ?? 0;
    const rightNetWorth = right.netWorthDelta ?? 0;
    if (leftNetWorth !== rightNetWorth) {
      return leftNetWorth - rightNetWorth;
    }

    return left.index - right.index;
  });

  return sorted[0]?.index ?? -1;
}

export class DecisionExpiryResolver {
  private readonly registry = new Map<string, RegisteredDecisionWindow>();

  public reset(): void {
    this.registry.clear();
  }

  public register(
    definition: DecisionWindowRegistration,
    snapshot: RunStateSnapshot,
  ): RegisteredDecisionWindow {
    const registered: RegisteredDecisionWindow = Object.freeze({
      windowId: definition.windowId,
      cardId: definition.cardId,
      actorId: normalizeActorId(definition.actorId, snapshot),
      cardType: definition.cardType,
      openedAtTick: definition.openedAtTick,
      openedAtMs: Math.trunc(definition.openedAtMs),
      durationMs: Math.max(0, Math.trunc(definition.durationMs)),
      worstOptionIndex: resolveWorstOptionIndex(definition.options),
      optionCount: definition.options.length,
      tags: dedupeTags(
        definition.tags ?? [],
        freezeArray([
          'decision-window',
          'decision-window:registered',
          `decision-card-type:${String(definition.cardType).toLowerCase()}`,
        ]),
      ),
    });

    this.registry.set(registered.windowId, registered);
    return registered;
  }

  public unregister(windowId: string): boolean {
    return this.registry.delete(windowId);
  }

  public has(windowId: string): boolean {
    return this.registry.has(windowId);
  }

  public get(windowId: string): RegisteredDecisionWindow | null {
    return this.registry.get(windowId) ?? null;
  }

  public getAll(): readonly RegisteredDecisionWindow[] {
    return freezeArray([...this.registry.values()]);
  }

  public syncWithSnapshot(snapshot: RunStateSnapshot): void {
    const liveWindowIds = new Set(Object.keys(snapshot.timers.activeDecisionWindows));

    for (const windowId of [...this.registry.keys()]) {
      if (!liveWindowIds.has(windowId)) {
        this.registry.delete(windowId);
      }
    }
  }

  public resolveExpired(
    snapshot: RunStateSnapshot,
    expiredWindowIds: readonly string[],
    nowMs: number,
  ): DecisionExpiryBatchResult {
    const outcomes: ExpiredDecisionOutcome[] = [];
    const unresolvedWindowIds: string[] = [];
    const generatedTags = new Set<string>();

    for (const windowId of expiredWindowIds) {
      const registered = this.registry.get(windowId);

      if (registered === undefined) {
        unresolvedWindowIds.push(windowId);
        generatedTags.add('decision-window:expiry-unresolved');
        continue;
      }

      const outcome: ExpiredDecisionOutcome = Object.freeze({
        windowId: registered.windowId,
        cardId: registered.cardId,
        actorId: registered.actorId,
        cardType: registered.cardType,
        selectedOptionIndex: registered.worstOptionIndex,
        reason: 'EXPIRED',
        openedAtTick: registered.openedAtTick,
        expiredAtTick: snapshot.tick,
        openedAtMs: registered.openedAtMs,
        expiredAtMs: Math.trunc(nowMs),
        durationMs: registered.durationMs,
        latencyMs: Math.max(0, Math.trunc(nowMs) - registered.openedAtMs),
        tags: dedupeTags(
          registered.tags,
          freezeArray([
            'decision-window:expired',
            registered.worstOptionIndex >= 0
              ? 'decision-window:worst-option-applied'
              : 'decision-window:no-option-fallback',
          ]),
        ),
      });

      for (const tag of outcome.tags) {
        generatedTags.add(tag);
      }

      outcomes.push(outcome);
      this.registry.delete(windowId);
    }

    return Object.freeze({
      outcomes: freezeArray(outcomes),
      unresolvedWindowIds: freezeArray(unresolvedWindowIds),
      generatedTags: freezeArray([...generatedTags]),
    });
  }

  public resolveNullified(windowId: string): boolean {
    return this.registry.delete(windowId);
  }

  public resolveAccepted(windowId: string): boolean {
    return this.registry.delete(windowId);
  }
}