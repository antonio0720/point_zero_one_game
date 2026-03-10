/*
 * POINT ZERO ONE — BACKEND MODES 15X GENERATOR
 * Generated at: 2026-03-10T01:26:02.003447+00:00
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 */

import type { CardDefinition } from '../../engine/core/GamePrimitives';
import type { CardPlayIntent, ModeAdapter, ModeFinalization, ModeFrame, ModeValidationResult } from '../contracts';
import { GHOST_WINDOW_RADIUS } from '../shared/constants';
import { applyModeOverlay, validateModeCardPlay } from '../shared/card_overlay';
import { finalizePhantom } from '../shared/cord';
import { cloneFrame, deepClone, pushEvent, updateParticipant } from '../shared/helpers';

function decayAttackCount(daysAlive: number): number {
  if (daysAlive >= 180) return 6;
  if (daysAlive >= 90) return 5;
  if (daysAlive >= 30) return 4;
  if (daysAlive >= 14) return 3;
  if (daysAlive >= 7) return 2;
  if (daysAlive >= 3) return 1;
  return 0;
}

export class PhantomModeAdapter implements ModeAdapter {
  public readonly mode = 'ghost' as const;

  public bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    next.participants = next.participants.slice(0, 1);
    const actorId = next.participants[0].playerId;
    next = updateParticipant(next, actorId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.modeState.loadoutEnabled = false;
      cloned.snapshot.modeState.legendMarkersEnabled = true;
      cloned.snapshot.modeState.holdEnabled = false;
      cloned.snapshot.modeState.advantageId = null;
      cloned.snapshot.modeState.handicapIds = [];
      cloned.snapshot.cards.ghostMarkers = next.legend?.markers ?? [];
      if (next.legend) {
        const effectiveHeat = next.legend.originalHeat + next.legend.communityRunsSince * 0.003;
        const perBotHeat = effectiveHeat / Math.max(1, cloned.snapshot.battle.bots.length);
        cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) => ({ ...bot, heat: bot.heat + perBotHeat }));
        cloned.metadata['legendCardPlays'] = Number(options?.legendCardPlays ?? 9999);
      }
      return cloned;
    });
    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId: null,
      code: 'PHANTOM_BOOTSTRAP',
      message: 'CHASE A LEGEND runtime bootstrapped with ghost markers + community heat.',
    });
  }

  public onTickStart(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    const actor = next.participants[0];
    const legend = next.legend;
    if (!legend) return next;

    const injections = decayAttackCount(legend.daysAlive);
    next = updateParticipant(next, actor.playerId, (participant) => {
      const cloned = deepClone(participant);
      if (injections >= 1 && !cloned.snapshot.tags.includes('LEGEND_DECAY_72H')) cloned.snapshot.tags.push('LEGEND_DECAY_72H');
      if (injections >= 2) cloned.snapshot.economy.incomePerTick = Math.max(0, cloned.snapshot.economy.incomePerTick - 150);
      if (injections >= 3) cloned.snapshot.economy.expensesPerTick += 120;
      if (injections >= 4) cloned.snapshot.economy.netWorth -= 800;
      if (injections >= 5) cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) => ({ ...bot, heat: bot.heat + 20 }));
      if (injections >= 6) cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) => ({ ...bot, heat: Math.max(bot.heat, 100) }));
      const delta = cloned.snapshot.sovereignty.sovereigntyScore - legend.legendScore;
      cloned.snapshot.sovereignty.gapVsLegend = delta;
      cloned.snapshot.sovereignty.gapClosingRate = Number((delta / Math.max(1, frame.tick)).toFixed(4));
      const nearMarker = cloned.snapshot.cards.ghostMarkers.find((marker) => Math.abs(marker.tick - frame.tick) <= GHOST_WINDOW_RADIUS);
      if (nearMarker) cloned.metadata['lastLegendMarkerKind'] = nearMarker.kind;
      return cloned;
    });

    if (next.tick % 10 === 0) {
      next = pushEvent(next, {
        tick: next.tick,
        level: 'INFO',
        channel: 'SYSTEM',
        actorId: actor.playerId,
        code: 'GAP_INDICATOR',
        message: `Gap delta=${actor.snapshot.sovereignty.gapVsLegend.toFixed(4)} closingRate=${actor.snapshot.sovereignty.gapClosingRate.toFixed(4)}`,
      });
    }
    return next;
  }

  public onTickEnd(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    next = updateParticipant(next, next.participants[0].playerId, (participant) => {
      const cloned = deepClone(participant);
      if (cloned.metadata['precisionHoldUntilTick'] && Number(cloned.metadata['precisionHoldUntilTick']) < frame.tick) {
        delete cloned.metadata['precisionHoldUntilTick'];
      }
      return cloned;
    });
    return next;
  }

  public validateCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const base = validateModeCardPlay(frame, intent);
    if (!base.ok) return base;
    const actor = frame.participants[0];
    if (intent.timing === 'GBM') {
      const nearMarker = actor.snapshot.cards.ghostMarkers.some((marker) => Math.abs(marker.tick - frame.tick) <= GHOST_WINDOW_RADIUS);
      if (!nearMarker) return { ok: false, reason: 'Ghost benchmark window is closed.', warnings: base.warnings };
    }
    return base;
  }

  public applyCardOverlay(frame: ModeFrame, _actorId: string, card: CardDefinition) {
    return applyModeOverlay(frame, card);
  }

  public resolveNamedAction(frame: ModeFrame, actorId: string, actionId: string, payload?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    if (actionId === 'PRECISION_HOLD') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        cloned.metadata['precisionHoldUntilTick'] = frame.tick + 4;
        return cloned;
      });
    } else if (actionId === 'MARKER_EXPLOIT') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        cloned.snapshot.shield.layers = cloned.snapshot.shield.layers.map((layer) => ({ ...layer, current: layer.current + 12 }));
        cloned.metadata['ghostSyncCount'] = Number(cloned.metadata['ghostSyncCount'] ?? 0) + 1;
        return cloned;
      });
    } else if (actionId === 'COUNTER_LEGEND_LINE') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        cloned.snapshot.economy.cash -= 3000;
        cloned.snapshot.tags.push('COUNTER_LEGEND_LINE');
        return cloned;
      });
    } else if (actionId === 'GHOST_PASS_EXPLOIT') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        if (cloned.snapshot.economy.incomePerTick > 1500) cloned.snapshot.sovereignty.sovereigntyScore += 0.04;
        return cloned;
      });
    }
    return next;
  }

  public finalize(frame: ModeFrame): ModeFinalization {
    return finalizePhantom(frame);
  }
}
