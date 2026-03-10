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

import type { CardDefinition, HaterBotId, RunPhase } from '../../engine/core/GamePrimitives';
import type { CardPlayIntent, ModeAdapter, ModeFinalization, ModeFrame, ModeValidationResult } from '../contracts';
import { PHASE_WINDOW_TICKS, SAFETY_CARD_IDS } from '../shared/constants';
import { applyModeOverlay, validateModeCardPlay } from '../shared/card_overlay';
import { finalizeEmpire } from '../shared/cord';
import { addForkHint, cloneFrame, deepClone, pushEvent, updateParticipant } from '../shared/helpers';

function phaseForElapsed(totalMs: number, elapsedMs: number): RunPhase {
  const fraction = totalMs <= 0 ? 0 : elapsedMs / totalMs;
  if (fraction < 1 / 3) return 'FOUNDATION';
  if (fraction < 2 / 3) return 'ESCALATION';
  return 'SOVEREIGNTY';
}

function applyHandicap(frame: ModeFrame, handicapId: string): ModeFrame {
  let next = cloneFrame(frame);
  if (handicapId === 'NO_CREDIT_HISTORY') {
    next = updateParticipant(next, next.participants[0].playerId, (participant) => {
      const cloned = deepClone(participant);
      const layer = cloned.snapshot.shield.layers.find((entry) => entry.layerId === 'L2');
      if (layer) {
        layer.current = Math.min(layer.current, 40);
        layer.max = Math.min(layer.max, 40);
      }
      cloned.metadata['debtCostMultiplier'] = 1.3;
      return cloned;
    });
  } else if (handicapId === 'SINGLE_INCOME') {
    next = updateParticipant(next, next.participants[0].playerId, (participant) => ({ ...participant, metadata: { ...participant.metadata, singleIncome: true } }));
  } else if (handicapId === 'TARGETED') {
    next = updateParticipant(next, next.participants[0].playerId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) =>
        bot.botId === 'BOT_01' ? { ...bot, heat: Math.max(bot.heat, 20) } : bot,
      );
      return cloned;
    });
  } else if (handicapId === 'CASH_POOR') {
    next = updateParticipant(next, next.participants[0].playerId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.economy.cash = Math.min(cloned.snapshot.economy.cash, 10000);
      return cloned;
    });
  } else if (handicapId === 'CLOCK_CURSED') {
    next = updateParticipant(next, next.participants[0].playerId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.timers.seasonBudgetMs = Math.min(cloned.snapshot.timers.seasonBudgetMs, 9 * 60 * 1000);
      return cloned;
    });
  }
  return next;
}

function applyAdvantage(frame: ModeFrame, advantageId: string | null): ModeFrame {
  if (!advantageId) return frame;
  let next = cloneFrame(frame);
  const actorId = next.participants[0].playerId;
  if (advantageId === 'MOMENTUM_CAPITAL') {
    next = updateParticipant(next, actorId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.economy.cash += 10000;
      return cloned;
    });
  } else if (advantageId === 'NETWORK_ACTIVATED') {
    next = updateParticipant(next, actorId, (participant) => {
      const cloned = deepClone(participant);
      const layer = cloned.snapshot.shield.layers.find((entry) => entry.layerId === 'L4');
      if (layer) {
        layer.max = Math.round(layer.max * 1.5);
        layer.current = Math.round(layer.current * 1.5);
      }
      return cloned;
    });
  } else if (advantageId === 'FORECLOSURE_BLOCK') {
    next = updateParticipant(next, actorId, (participant) => ({ ...participant, metadata: { ...participant.metadata, foreclosureBlockUntilTick: 5 } }));
  } else if (advantageId === 'INTEL_PASS') {
    next = updateParticipant(next, actorId, (participant) => ({ ...participant, metadata: { ...participant.metadata, exposedThreatAllowance: 3 } }));
  } else if (advantageId === 'PHANTOM_SEED') {
    next = updateParticipant(next, actorId, (participant) => ({ ...participant, metadata: { ...participant.metadata, phantomSeedDraw: 1 } }));
  } else if (advantageId === 'DEBT_SHIELD') {
    next = updateParticipant(next, actorId, (participant) => ({ ...participant, metadata: { ...participant.metadata, autoDebtCounter: 1 } }));
  }
  return next;
}

export class EmpireModeAdapter implements ModeAdapter {
  public readonly mode = 'solo' as const;

  public bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    const actorId = next.participants[0].playerId;
    next.participants = next.participants.slice(0, 1);
    next = updateParticipant(next, actorId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.modeState.holdEnabled = true;
      cloned.snapshot.modeState.loadoutEnabled = true;
      cloned.snapshot.modeState.sharedTreasury = false;
      cloned.snapshot.modeState.legendMarkersEnabled = false;
      cloned.snapshot.modeState.phaseBoundaryWindowsRemaining = 0;
      cloned.snapshot.modeState.bleedMode = false;
      return cloned;
    });

    const handicapIds = Array.isArray(options?.handicapIds) ? (options?.handicapIds as string[]) : [];
    const bleed = handicapIds.includes('DISADVANTAGE_DRAFT') || options?.bleedMode === true;
    const normalizedHandicaps = bleed
      ? ['NO_CREDIT_HISTORY', 'SINGLE_INCOME', 'TARGETED', 'CASH_POOR', 'CLOCK_CURSED', 'DISADVANTAGE_DRAFT']
      : handicapIds;

    for (const handicapId of normalizedHandicaps) next = applyHandicap(next, handicapId);
    next = applyAdvantage(next, (options?.advantageId as string | null | undefined) ?? null);
    next = updateParticipant(next, actorId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.modeState.handicapIds = normalizedHandicaps;
      cloned.snapshot.modeState.advantageId = (options?.advantageId as string | null | undefined) ?? null;
      cloned.snapshot.modeState.disabledBots = ((options?.disabledBots as HaterBotId[] | undefined) ?? []).slice();
      cloned.snapshot.modeState.bleedMode = bleed;
      cloned.metadata['bleedMode'] = bleed;
      if (bleed) {
        cloned.snapshot.modeState.holdEnabled = false;
        cloned.snapshot.timers.holdCharges = 0;
        cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) => ({ ...bot, heat: Math.max(bot.heat, 25) }));
      }
      if (Array.isArray(options?.disabledBots)) {
        const disabled = new Set(options?.disabledBots as string[]);
        cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) =>
          disabled.has(bot.botId) ? { ...bot, state: 'DORMANT', heat: 0 } : bot,
        );
      }
      return cloned;
    });
    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId: null,
      code: 'EMPIRE_BOOTSTRAP',
      message: 'GO ALONE runtime bootstrapped with authoritative loadout + handicap state.',
    });
  }

  public onTickStart(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    const actor = next.participants[0];
    const totalMs = actor.snapshot.timers.seasonBudgetMs;
    const phase = phaseForElapsed(totalMs, actor.snapshot.timers.elapsedMs);
    const priorPhase = actor.snapshot.phase;
    if (phase !== priorPhase) {
      next = updateParticipant(next, actor.playerId, (participant) => {
        const cloned = deepClone(participant);
        cloned.snapshot.phase = phase;
        cloned.snapshot.modeState.phaseBoundaryWindowsRemaining = PHASE_WINDOW_TICKS;
        return cloned;
      });
      next = pushEvent(next, {
        tick: next.tick,
        level: phase === 'SOVEREIGNTY' ? 'ALERT' : 'WARNING',
        channel: 'SYSTEM',
        actorId: null,
        code: 'PHASE_TRANSITION',
        message: phase === 'ESCALATION' ? 'Phase 2 has begun. The haters are awake.' : 'Phase 3 has begun. Sovereignty pressure is live.',
      });
    }

    next = updateParticipant(next, actor.playerId, (participant) => {
      let cloned = deepClone(participant);
      const hasIncomeCard = cloned.snapshot.cards.hand.some((card) => card.tags.includes('income'));
      const lowCash = cloned.snapshot.economy.cash < 5000;
      const noShield = cloned.snapshot.shield.layers.every((layer) => layer.current <= 0);
      const repeated = Object.values(cloned.snapshot.cascade.repeatedTriggerCounts as Record<string, number>).some((value) => value >= 2);

      const incomeDryStreak = Number(cloned.metadata['incomeDryStreak'] ?? 0);
      cloned.metadata['incomeDryStreak'] = hasIncomeCard ? 0 : incomeDryStreak + 1;

      if (Number(cloned.metadata['incomeDryStreak']) >= 3) {
        cloned.snapshot.sovereignty.sovereigntyScore = Number((cloned.snapshot.sovereignty.sovereigntyScore - 0.002).toFixed(6));
      }
      if (lowCash) {
        const liquidity = cloned.snapshot.shield.layers.find((layer) => layer.layerId === 'L1');
        if (liquidity) liquidity.regenPerTick = Math.max(1, Math.floor(liquidity.regenPerTick / 2));
      }
      if (repeated) cloned.metadata['cascadeAmplifier'] = 1.5;
      if ((cloned.snapshot.pressure.tier === 'T3' || cloned.snapshot.pressure.tier === 'T4') && noShield) {
        cloned.snapshot.timers.activeDecisionWindows = Object.fromEntries(
          Object.entries(cloned.snapshot.timers.activeDecisionWindows as Record<string, number>).map(([key, value]) => [key, Math.max(1, Math.floor(value * 0.75))]),
        );
      }

      if (cloned.snapshot.economy.cash < 2000) {
        cloned.metadata['comebackLowCashTicks'] = Number(cloned.metadata['comebackLowCashTicks'] ?? 0) + 1;
        const currentFloor = Number(cloned.metadata['cashFloor'] ?? Number.MAX_SAFE_INTEGER);
        cloned.metadata['cashFloor'] = Math.min(currentFloor, cloned.snapshot.economy.cash);
      } else {
        const streak = Number(cloned.metadata['comebackLowCashTicks'] ?? 0);
        if (streak >= 15 && cloned.snapshot.economy.cash > 8000) {
          cloned.metadata['comebackSurgeUntilTick'] = frame.tick + 20;
          cloned.snapshot.tags.push('COMEBACK_SURGE');
        }
        if (streak >= 15 && cloned.snapshot.economy.cash > 20000) {
          cloned.snapshot.shield.layers = cloned.snapshot.shield.layers.map((layer) => ({ ...layer, regenPerTick: layer.regenPerTick * 2 }));
        }
        cloned.metadata['comebackLowCashTicks'] = 0;
      }

      if (Number(cloned.metadata['comebackSurgeUntilTick'] ?? -1) >= frame.tick) {
        cloned.metadata['decisionSpeedCordWeight'] = 0.35;
      }

      if (frame.tick % 15 === 0) {
        let hint = 'Foundation remains open. Build income before the haters circle.';
        if (cloned.snapshot.phase === 'ESCALATION') hint = 'Escalation live: hesitation is extending Manipulator pressure.';
        if (cloned.snapshot.phase === 'SOVEREIGNTY') hint = 'Sovereignty live: every tick under pressure is worth more if you survive it.';
        cloned = addForkHint(cloned, hint);
      }
      return cloned;
    });

    return next;
  }

  public onTickEnd(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    next = updateParticipant(next, next.participants[0].playerId, (participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.modeState.phaseBoundaryWindowsRemaining = Math.max(0, cloned.snapshot.modeState.phaseBoundaryWindowsRemaining - 1);
      if ((cloned.metadata['bleedMode'] === true || cloned.snapshot.modeState.bleedMode) && cloned.snapshot.economy.cash <= 0) {
        cloned.snapshot.tags.push('VOID_SCAR');
      }
      if (cloned.snapshot.outcome === 'FREEDOM' && Number(cloned.metadata['cashFloor'] ?? Number.MAX_SAFE_INTEGER) < 2000) {
        cloned.metadata['comebackFreedom'] = true;
      }
      return cloned;
    });
    return next;
  }

  public validateCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const base = validateModeCardPlay(frame, intent);
    if (!base.ok) return base;
    const card = 'card' in intent.card ? intent.card.card : intent.card;
    const actor = frame.participants[0];
    if ((actor.metadata['singleIncome'] === true || actor.snapshot.modeState.handicapIds.includes('SINGLE_INCOME')) && card.tags.includes('income')) {
      const heldIncomeCards = actor.snapshot.cards.hand.filter((entry) => entry.tags.includes('income')).length;
      if (heldIncomeCards >= 1) return { ok: false, reason: 'Single Income handicap prevents a second income hold.', warnings: base.warnings };
    }
    if ((actor.metadata['bleedMode'] === true || actor.snapshot.modeState.bleedMode) && SAFETY_CARD_IDS.has(card.id)) {
      return { ok: false, reason: 'Bleed mode removes safety cards from the legal pool.', warnings: base.warnings };
    }
    if (intent.timing === 'PHZ' && actor.snapshot.modeState.phaseBoundaryWindowsRemaining <= 0) {
      return { ok: false, reason: 'Phase boundary window is closed.', warnings: base.warnings };
    }
    return base;
  }

  public applyCardOverlay(frame: ModeFrame, _actorId: string, card: CardDefinition) {
    return applyModeOverlay(frame, card);
  }

  public resolveNamedAction(frame: ModeFrame, actorId: string, actionId: string, payload?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    if (actionId === 'HOLD' && next.participants[0].snapshot.modeState.holdEnabled) {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        if (cloned.snapshot.timers.holdCharges <= 0) return cloned;
        const windowId = String(payload?.windowId ?? 'default');
        cloned.snapshot.timers.holdCharges -= 1;
        cloned.snapshot.timers.frozenWindowIds.push(windowId);
        cloned.snapshot.tags.push('HOLD_USED');
        return cloned;
      });
      next = pushEvent(next, {
        tick: next.tick,
        level: 'INFO',
        channel: 'SYSTEM',
        actorId,
        code: 'HOLD_USED',
        message: 'Empire hold action authorized by backend.',
      });
    }
    return next;
  }

  public finalize(frame: ModeFrame): ModeFinalization {
    return finalizeEmpire(frame);
  }
}
