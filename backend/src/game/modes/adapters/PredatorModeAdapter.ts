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
import type { CardPlayIntent, CounterCardId, ExtractionActionId, ModeAdapter, ModeFinalization, ModeFrame, ModeParticipant, ModeValidationResult } from '../contracts';
import { COUNTER_COSTS, COUNTER_TO_EXTRACTION, EXTRACTION_COSTS } from '../shared/constants';
import { applyModeOverlay, validateModeCardPlay } from '../shared/card_overlay';
import { finalizePredator } from '../shared/cord';
import { calcPsycheState, cloneFrame, deepClone, pushEvent, shieldPct, updateParticipant } from '../shared/helpers';

function actorAndTarget(frame: ModeFrame, actorId: string, targetId?: string): [ModeParticipant, ModeParticipant] | null {
  const actor = frame.participants.find((participant) => participant.playerId === actorId);
  const target = frame.participants.find((participant) => participant.playerId === targetId) ?? frame.participants.find((participant) => participant.playerId !== actorId);
  return actor && target ? [actor, target] : null;
}

function grantBattleBudget(participant: ModeParticipant): ModeParticipant {
  const cloned = deepClone(participant);
  const freezeUntil = Number(cloned.metadata['bbFrozenUntilTick'] ?? -1);
  if (freezeUntil >= cloned.snapshot.tick) return cloned;
  const perTick = cloned.snapshot.pressure.tier === 'T3' || cloned.snapshot.pressure.tier === 'T4' ? 4 : 2;
  cloned.snapshot.battle.battleBudget = Math.min(cloned.snapshot.battle.battleBudgetCap, cloned.snapshot.battle.battleBudget + perTick);
  return cloned;
}

export class PredatorModeAdapter implements ModeAdapter {
  public readonly mode = 'pvp' as const;

  public bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    next.participants = next.participants.slice(0, 2);
    next.participants = next.participants.map((participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.modeState.sharedOpportunityDeck = true;
      cloned.snapshot.modeState.spectatorLimit = 50;
      cloned.snapshot.modeState.holdEnabled = false;
      cloned.snapshot.battle.battleBudgetCap = 200;
      cloned.snapshot.battle.battleBudget = Number(options?.battleBudgetStart ?? 0);
      return cloned;
    });
    next.rivalry = {
      playerA: next.participants[0].playerId,
      playerB: next.participants[1].playerId,
      matchesPlayed: Number(options?.matchesPlayed ?? 0),
      wins: Object.fromEntries(next.participants.map((participant) => [participant.playerId, Number(((options?.wins as Record<string, number> | undefined)?.[participant.playerId]) ?? 0)])),
      archRivalUnlocked: Number(options?.matchesPlayed ?? 0) >= 10,
      nemesisUnlocked: Number(options?.matchesPlayed ?? 0) >= 20,
      carryHeatByPlayer: Object.fromEntries(next.participants.map((participant) => [participant.playerId, Number(((options?.carryHeatByPlayer as Record<string, number> | undefined)?.[participant.playerId]) ?? 0)])),
    };
    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId: null,
      code: 'PREDATOR_BOOTSTRAP',
      message: 'HEAD TO HEAD runtime bootstrapped with shared deck + battle budget.',
    });
  }

  public onTickStart(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    next.participants = next.participants.map(grantBattleBudget);
    const [a, b] = next.participants;
    const richer = a.snapshot.economy.netWorth >= b.snapshot.economy.netWorth ? a : b;
    next = updateParticipant(next, richer.playerId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.tension.score = Number((cloned.snapshot.tension.score + 0.04).toFixed(4));
      return cloned;
    });
    if (Math.abs(a.snapshot.economy.netWorth - b.snapshot.economy.netWorth) > 20000) {
      const target = a.snapshot.economy.netWorth > b.snapshot.economy.netWorth ? a.playerId : b.playerId;
      next = updateParticipant(next, target, (participant) => ({ ...deepClone(participant), metadata: { ...participant.metadata, fubarRouteChance: 0.4 } }));
    }

    if (next.tick % 5 === 0) {
      for (const participant of next.participants) {
        const opponent = next.participants.find((candidate) => candidate.playerId !== participant.playerId)!;
        next = pushEvent(next, {
          tick: next.tick,
          level: 'INFO',
          channel: 'SPECTATOR',
          actorId: null,
          code: 'PSYCHE_PROJECTION',
          message: `${participant.playerId} sees opponent psyche=${calcPsycheState(opponent)}`,
          payload: { participantId: participant.playerId, opponentId: opponent.playerId },
        });
      }
    }
    return next;
  }

  public onTickEnd(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    next.participants = next.participants.map((participant) => {
      const cloned = deepClone(participant);
      if (Number(cloned.metadata['incomeDebuffUntilTick'] ?? -1) < next.tick) {
        delete cloned.metadata['incomeDebuffPct'];
      }
      if (Number(cloned.metadata['cardsLockedUntilTick'] ?? -1) < next.tick) {
        delete cloned.metadata['cardsLockedUntilTick'];
      }
      if (Number(cloned.metadata['incomingExtractionUntilTick'] ?? -1) < next.tick) {
        delete cloned.metadata['incomingExtractionUntilTick'];
      }
      return cloned;
    });
    return next;
  }

  public validateCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const base = validateModeCardPlay(frame, intent);
    if (!base.ok) return base;
    const actor = frame.participants.find((participant) => participant.playerId === intent.actorId);
    const card = 'card' in intent.card ? intent.card.card : intent.card;
    if (!actor) return { ok: false, reason: 'Unknown actor.', warnings: base.warnings };
    if (Number(actor.metadata['cardsLockedUntilTick'] ?? -1) >= frame.tick) {
      return { ok: false, reason: 'Regulatory filing locked this player hand.', warnings: base.warnings };
    }
    if (card.deckType === 'COUNTER' && Number(actor.metadata['incomingExtractionUntilTick'] ?? -1) !== frame.tick) {
      return { ok: false, reason: 'Counter cards require an active counter window.', warnings: base.warnings };
    }
    return base;
  }

  public applyCardOverlay(frame: ModeFrame, _actorId: string, card: CardDefinition) {
    return applyModeOverlay(frame, card);
  }

  public resolveNamedAction(frame: ModeFrame, actorId: string, actionId: string, payload?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    const pair = actorAndTarget(next, actorId, payload?.targetId as string | undefined);
    if (!pair) return next;
    const [actor, target] = pair;

    const attemptCounter = actionId as CounterCardId;
    const isCounter = attemptCounter in COUNTER_TO_EXTRACTION;
    if (isCounter) {
      const cost = COUNTER_COSTS[attemptCounter];
      next = updateParticipant(next, actor.playerId, (participant) => {
        const cloned = deepClone(participant);
        if (cloned.snapshot.battle.battleBudget < cost) return cloned;
        cloned.snapshot.battle.battleBudget -= cost;
        cloned.metadata['counterSuccessCount'] = Number(cloned.metadata['counterSuccessCount'] ?? 0) + 1;
        return cloned;
      });
      next = updateParticipant(next, target.playerId, (participant) => {
        const cloned = deepClone(participant);
        if (attemptCounter === 'LIQUIDITY_WALL') {
          cloned.metadata['incomeDebuffPct'] = 0.10;
          cloned.metadata['incomeDebuffUntilTick'] = frame.tick + 1;
        } else if (attemptCounter === 'CREDIT_FREEZE') {
          cloned.metadata['bbFrozenUntilTick'] = frame.tick + 3;
        } else if (attemptCounter === 'EVIDENCE_FILE') {
          cloned.metadata['cardsLockedUntilTick'] = frame.tick + 1;
        } else if (attemptCounter === 'SIGNAL_CLEAR') {
          cloned.metadata['misinformationClearedAtTick'] = frame.tick;
        } else if (attemptCounter === 'DEBT_SHIELD') {
          const participantClone = deepClone(cloned);
          participantClone.snapshot.economy.cash += 2000;
          return participantClone;
        } else if (attemptCounter === 'SOVEREIGNTY_LOCK') {
          cloned.snapshot.battle.battleBudget = Math.max(0, cloned.snapshot.battle.battleBudget - 30);
        } else if (attemptCounter === 'FORCED_DRAW_BLOCK') {
          cloned.metadata['forcedDrawBlockedAtTick'] = frame.tick;
        }
        return cloned;
      });
      return pushEvent(next, {
        tick: next.tick,
        level: 'SUCCESS',
        channel: 'SYSTEM',
        actorId,
        code: 'COUNTER_LANDED',
        message: `${actionId} countered ${String(payload?.blockedActionId ?? 'incoming extraction')}.`,
      });
    }

    const extraction = actionId as ExtractionActionId;
    const rawCost = EXTRACTION_COSTS[extraction];
    const discount = next.rivalry?.archRivalUnlocked ? 0.8 : 1.0;
    const cost = Math.round(rawCost * discount);

    next = updateParticipant(next, actor.playerId, (participant) => {
      const cloned = deepClone(participant);
      if (cloned.snapshot.battle.battleBudget < cost) return cloned;
      cloned.snapshot.battle.battleBudget -= cost;
      cloned.metadata['extractionCooldownUntilTick'] = frame.tick + 3;
      return cloned;
    });

    next = updateParticipant(next, target.playerId, (participant) => {
      const cloned = deepClone(participant);
      cloned.metadata['incomingExtractionUntilTick'] = frame.tick;
      if (extraction === 'MARKET_DUMP') {
        const pct = 0.20;
        cloned.metadata['incomeDebuffPct'] = pct;
        cloned.metadata['incomeDebuffUntilTick'] = frame.tick + 2;
        cloned.snapshot.economy.incomePerTick = Math.max(0, Math.round(cloned.snapshot.economy.incomePerTick * 0.8));
      } else if (extraction === 'CREDIT_REPORT_PULL') {
        const layer = cloned.snapshot.shield.layers.find((entry) => entry.layerId === 'L2');
        if (layer) layer.current = Math.max(0, layer.current - 15);
        if ((layer?.current ?? 100) < 20) cloned.snapshot.economy.expensesPerTick += 200;
      } else if (extraction === 'REGULATORY_FILING') {
        cloned.metadata['cardsLockedUntilTick'] = frame.tick + 3;
      } else if (extraction === 'MISINFORMATION_FLOOD') {
        cloned.metadata['falseDataUntilTick'] = frame.tick + 2;
      } else if (extraction === 'DEBT_INJECTION') {
        cloned.snapshot.economy.debt += 5000;
        cloned.snapshot.economy.expensesPerTick += 250;
      } else if (extraction === 'HOSTILE_TAKEOVER') {
        cloned.snapshot.economy.incomePerTick = Math.floor(cloned.snapshot.economy.incomePerTick * 0.5);
      } else if (extraction === 'LIQUIDATION_NOTICE') {
        if (cloned.metadata['forcedDrawBlockedAtTick'] !== frame.tick) cloned.metadata['forcedFubarNextTick'] = true;
      }
      return cloned;
    });

    next = updateParticipant(next, actor.playerId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.battle.battleBudget = Math.min(cloned.snapshot.battle.battleBudgetCap, cloned.snapshot.battle.battleBudget + 8);
      if (cloned.metadata['firstBlood'] !== true) {
        cloned.metadata['firstBlood'] = true;
        cloned.snapshot.battle.battleBudget = Math.min(cloned.snapshot.battle.battleBudgetCap, cloned.snapshot.battle.battleBudget + 5);
      }
      return cloned;
    });

    return pushEvent(next, {
      tick: next.tick,
      level: 'WARNING',
      channel: 'SYSTEM',
      actorId,
      code: 'EXTRACTION_LANDED',
      message: `${extraction} fired at ${target.playerId}.`,
      payload: { targetId: target.playerId, battleBudgetCost: cost },
    });
  }

  public finalize(frame: ModeFrame): ModeFinalization {
    return finalizePredator(frame);
  }
}
