/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardTargetingResolver.ts
 *
 * Doctrine:
 * - targeting is backend-authoritative
 * - target legality is mode-native, not UI-trusted
 * - simple enum targeting must still be explicit and deterministic
 * - this resolver validates target class, not player identity selection
 */

import type { CardInstance, ModeCode, Targeting } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

const TARGET_MATRIX: Readonly<
  Record<ModeCode, Readonly<Record<Targeting, readonly Targeting[]>>>
> = Object.freeze({
  solo: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: Object.freeze([] as readonly Targeting[]),
    TEAMMATE: Object.freeze([] as readonly Targeting[]),
    TEAM: Object.freeze([] as readonly Targeting[]),
    GLOBAL: Object.freeze(['GLOBAL'] as readonly Targeting[]),
  }),
  pvp: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: Object.freeze(['OPPONENT'] as readonly Targeting[]),
    TEAMMATE: Object.freeze([] as readonly Targeting[]),
    TEAM: Object.freeze([] as readonly Targeting[]),
    GLOBAL: Object.freeze(['GLOBAL'] as readonly Targeting[]),
  }),
  coop: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: Object.freeze([] as readonly Targeting[]),
    TEAMMATE: Object.freeze(['TEAMMATE', 'TEAM'] as readonly Targeting[]),
    TEAM: Object.freeze(['TEAM'] as readonly Targeting[]),
    GLOBAL: Object.freeze(['GLOBAL'] as readonly Targeting[]),
  }),
  ghost: Object.freeze({
    SELF: Object.freeze(['SELF'] as readonly Targeting[]),
    OPPONENT: Object.freeze([] as readonly Targeting[]),
    TEAMMATE: Object.freeze([] as readonly Targeting[]),
    TEAM: Object.freeze([] as readonly Targeting[]),
    GLOBAL: Object.freeze(['GLOBAL'] as readonly Targeting[]),
  }),
});

export class CardTargetingResolver {
  public isAllowed(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    targeting: Targeting,
  ): boolean {
    const allowed = TARGET_MATRIX[snapshot.mode][card.targeting];
    return allowed.includes(targeting);
  }
}