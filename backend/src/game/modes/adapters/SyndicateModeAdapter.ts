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
import type { CardPlayIntent, ModeAdapter, ModeFinalization, ModeFrame, ModeValidationResult, TeamRoleId, TrustAuditLine } from '../contracts';
import { applyModeOverlay, validateModeCardPlay } from '../shared/card_overlay';
import { finalizeSyndicate } from '../shared/cord';
import { cloneFrame, deepClone, pushEvent, updateParticipant } from '../shared/helpers';

const ALL_ROLES: TeamRoleId[] = ['INCOME_BUILDER', 'SHIELD_ARCHITECT', 'OPPORTUNITY_HUNTER', 'COUNTER_INTEL'];

function initialTrustAudit(frame: ModeFrame): Record<string, TrustAuditLine> {
  return Object.fromEntries(
    frame.participants.map((participant) => [
      participant.playerId,
      {
        playerId: participant.playerId,
        trustScore: 50,
        aidGivenCount: 0,
        rescueCount: 0,
        cascadeAbsorptions: 0,
        loanRepaymentRate: 1,
        defectionRiskSignal: 'LOW',
        notes: [],
      },
    ]),
  );
}

function applyRolePassives(frame: ModeFrame): ModeFrame {
  let next = cloneFrame(frame);
  for (const participant of next.participants) {
    next = updateParticipant(next, participant.playerId, (current) => {
      const cloned = deepClone(current);
      if (cloned.roleId === 'INCOME_BUILDER') {
        cloned.snapshot.economy.incomePerTick = Math.round(cloned.snapshot.economy.incomePerTick * 1.15);
      } else if (cloned.roleId === 'SHIELD_ARCHITECT') {
        cloned.snapshot.shield.layers = cloned.snapshot.shield.layers.map((layer) =>
          layer.layerId === 'L1' || layer.layerId === 'L2' ? { ...layer, regenPerTick: 3 } : layer,
        );
      } else if (cloned.roleId === 'OPPORTUNITY_HUNTER') {
        cloned.metadata['firstLookCharges'] = 1;
      } else if (cloned.roleId === 'COUNTER_INTEL') {
        cloned.snapshot.modeState.counterIntelTier = Math.max(cloned.snapshot.modeState.counterIntelTier, 2);
      }
      return cloned;
    });
  }
  const activeRoles = new Set(next.participants.map((participant) => participant.roleId).filter(Boolean));
  if (ALL_ROLES.every((roleId) => activeRoles.has(roleId))) {
    next.participants = next.participants.map((participant) => {
      const cloned = deepClone(participant);
      cloned.snapshot.shield.layers = cloned.snapshot.shield.layers.map((layer) => ({
        ...layer,
        current: Math.round(layer.current * 1.1),
        max: Math.round(layer.max * 1.1),
      }));
      return cloned;
    });
    if (next.syndicate) {
      next.syndicate.treasuryBalance += 8000;
    }
    next = pushEvent(next, {
      tick: next.tick,
      level: 'SUCCESS',
      channel: 'TEAM',
      actorId: null,
      code: 'FULL_SYNERGY',
      message: 'All four roles present. Team synergy bonus is live.',
    });
  }
  return next;
}

export class SyndicateModeAdapter implements ModeAdapter {
  public readonly mode = 'coop' as const;

  public bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    next.syndicate = {
      treasuryBalance: next.participants.reduce((sum, participant) => sum + participant.snapshot.economy.cash, 0),
      freedomThreshold: Math.round((options?.soloFreedomThreshold as number | undefined ?? next.participants[0].snapshot.economy.freedomTarget) * 1.8),
      freedPlayerIds: [],
      defectedPlayerIds: [],
      splitDisposition: 'NONE',
      trustAudit: initialTrustAudit(next),
    };
    next.participants = next.participants.map((participant, index) => {
      const cloned = deepClone(participant);
      cloned.snapshot.modeState.sharedTreasury = true;
      cloned.snapshot.modeState.holdEnabled = false;
      cloned.snapshot.modeState.loadoutEnabled = false;
      cloned.snapshot.economy.cash = 0;
      cloned.roleId = (Array.isArray(options?.roleIds) ? options?.roleIds[index] : null) as TeamRoleId | null;
      return cloned;
    });
    next = applyRolePassives(next);
    return pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'TEAM',
      actorId: null,
      code: 'SYNDICATE_BOOTSTRAP',
      message: 'TEAM UP runtime bootstrapped with shared treasury + trust audit.',
    });
  }

  public onTickStart(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    if (!next.syndicate) return next;

    const netTickFlow = next.participants.reduce(
      (sum, participant) => sum + participant.snapshot.economy.incomePerTick - participant.snapshot.economy.expensesPerTick,
      0,
    );
    next.syndicate.treasuryBalance += netTickFlow;

    const activePlayers = next.participants.filter((participant) => !next.syndicate?.defectedPlayerIds.includes(participant.playerId));
    if (next.syndicate.treasuryBalance < 3000 && activePlayers.length >= 2) {
      next.participants = next.participants.map((participant) => {
        const cloned = deepClone(participant);
        cloned.snapshot.shield.layers = cloned.snapshot.shield.layers.map((layer) => ({
          ...layer,
          regenPerTick: Math.max(1, Math.floor(layer.regenPerTick / 2)),
        }));
        return cloned;
      });
    }

    for (const participant of next.participants) {
      const audit = next.syndicate!.trustAudit[participant.playerId];
      const deltas =
        (Number(participant.metadata['aidGivenCount'] ?? 0) * 4) +
        (Number(participant.metadata['rescueCount'] ?? 0) * 6) +
        (Number(participant.metadata['cascadeAbsorptions'] ?? 0) * 8) -
        (Number(participant.metadata['defectionStep'] ?? 0) * 5);
      audit.trustScore = Math.max(0, Math.min(100, 50 + deltas));
      audit.defectionRiskSignal = audit.trustScore < 35 ? 'CRITICAL' : audit.trustScore < 50 ? 'HIGH' : audit.trustScore < 70 ? 'MEDIUM' : 'LOW';
      (participant.snapshot.modeState.trustScores as Record<string, number>)[participant.playerId] = audit.trustScore;
      if (participant.snapshot.pressure.tier === 'T4') {
        next = pushEvent(next, {
          tick: next.tick,
          level: 'ALERT',
          channel: 'TEAM',
          actorId: null,
          code: 'WAR_ALERT',
          message: `${participant.playerId} is in CRITICAL pressure. Weakest layer=${participant.snapshot.shield.weakestLayerId}.`,
        });
      }
    }
    return next;
  }

  public onTickEnd(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    if (!next.syndicate) return next;
    for (const participant of next.participants) {
      if (participant.snapshot.outcome === 'FREEDOM' && !next.syndicate!.freedPlayerIds.includes(participant.playerId)) {
        next.syndicate!.freedPlayerIds.push(participant.playerId);
      }
    }
    return next;
  }

  public validateCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const base = validateModeCardPlay(frame, intent);
    if (!base.ok) return base;
    const card = 'card' in intent.card ? intent.card.card : intent.card;
    if (['AID', 'RESCUE', 'TRUST'].includes(card.deckType) && !intent.targetId) {
      return { ok: false, reason: 'Support cards require a teammate target.', warnings: base.warnings };
    }
    return base;
  }

  public applyCardOverlay(frame: ModeFrame, _actorId: string, card: CardDefinition) {
    return applyModeOverlay(frame, card);
  }

  public resolveNamedAction(frame: ModeFrame, actorId: string, actionId: string, payload?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    if (!next.syndicate) return next;

    if (actionId === 'DOUBLE_TAP') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        if (cloned.roleId !== 'INCOME_BUILDER') return cloned;
        cloned.snapshot.economy.incomePerTick *= 2;
        cloned.metadata['doubleTapUntilTick'] = frame.tick + 2;
        return cloned;
      });
    } else if (actionId === 'FORTRESS_MODE') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        if (cloned.roleId !== 'SHIELD_ARCHITECT') return cloned;
        cloned.snapshot.shield.layers = cloned.snapshot.shield.layers.map((layer) => ({ ...layer, current: layer.current + 20 }));
        cloned.metadata['fortressModeUntilTick'] = frame.tick + 3;
        return cloned;
      });
    } else if (actionId === 'FIRST_LOOK') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        if (cloned.roleId !== 'OPPORTUNITY_HUNTER') return cloned;
        cloned.metadata['firstLookUsed'] = true;
        return cloned;
      });
    } else if (actionId === 'SIGNAL_JAM') {
      next = updateParticipant(next, actorId, (participant) => {
        const cloned = deepClone(participant);
        if (cloned.roleId !== 'COUNTER_INTEL') return cloned;
        cloned.metadata['signalJamUntilTick'] = frame.tick + 4;
        return cloned;
      });
      next.history.push({
        tick: next.tick,
        level: 'SUCCESS',
        channel: 'TEAM',
        actorId,
        code: 'SIGNAL_JAM',
        message: 'Counter-Intel suppressed hater bot arrivals for 4 ticks.',
      });
    } else if (actionId === 'EMERGENCY_CAPITAL') {
      const targetId = String(payload?.targetId ?? '');
      if (targetId && next.syndicate!.treasuryBalance > 0) {
        const full = frame.participants.find((participant) => participant.playerId === targetId)?.snapshot.economy.cash ?? 0 < 2000;
        const amount = full ? 8000 : 4000;
        next.syndicate!.treasuryBalance -= amount;
        next = updateParticipant(next, targetId, (participant) => {
          const cloned = deepClone(participant);
          cloned.snapshot.economy.cash += amount;
          return cloned;
        });
        next.syndicate!.trustAudit[actorId].aidGivenCount += 1;
      }
    } else if (actionId === 'CASCADE_INTERRUPT') {
      const targetId = String(payload?.targetId ?? '');
      next = updateParticipant(next, targetId, (participant) => {
        const cloned = deepClone(participant);
        const full = cloned.snapshot.cascade.activeChains.length > 0;
        if (full) cloned.snapshot.cascade.activeChains = [];
        else if (cloned.snapshot.cascade.activeChains[0]) cloned.snapshot.cascade.activeChains[0].links = cloned.snapshot.cascade.activeChains[0].links.slice(1);
        return cloned;
      });
      next.syndicate!.trustAudit[actorId].cascadeAbsorptions += 1;
    } else if (actionId === 'SHIELD_EMERGENCY') {
      const targetId = String(payload?.targetId ?? '');
      next = updateParticipant(next, targetId, (participant) => {
        const cloned = deepClone(participant);
        const l4 = cloned.snapshot.shield.layers.find((layer) => layer.layerId === 'L4');
        if (l4) l4.current += l4.current < 10 ? 20 : 10;
        return cloned;
      });
      next.syndicate!.trustAudit[actorId].rescueCount += 1;
    } else if (actionId === 'INCOME_INFUSION') {
      const targetId = String(payload?.targetId ?? '');
      const actor = next.participants.find((participant) => participant.playerId === actorId);
      const amount = (actor?.snapshot.economy.incomePerTick ?? 0) * ((payload?.timely as boolean | undefined) === false ? 1 : 2);
      next = updateParticipant(next, targetId, (participant) => {
        const cloned = deepClone(participant);
        cloned.snapshot.economy.cash += amount;
        return cloned;
      });
      next.syndicate!.trustAudit[actorId].aidGivenCount += 1;
    } else if (actionId === 'BREAK_PACT') {
      next = updateParticipant(next, actorId, (participant) => ({ ...deepClone(participant), metadata: { ...participant.metadata, defectionStep: 1 } }));
    } else if (actionId === 'SILENT_EXIT') {
      next = updateParticipant(next, actorId, (participant) => ({ ...deepClone(participant), metadata: { ...participant.metadata, defectionStep: 2, incomeDiversionPct: 0.15 } }));
    } else if (actionId === 'ASSET_SEIZURE') {
      if (frame.tick >= 8) {
        const take = Math.round(next.syndicate.treasuryBalance * 0.4);
        next.syndicate.treasuryBalance -= take;
        next.syndicate!.defectedPlayerIds.push(actorId);
        next.syndicate!.splitDisposition = 'DEFECTOR_SPLIT';
        next = updateParticipant(next, actorId, (participant) => {
          const cloned = deepClone(participant);
          cloned.snapshot.economy.cash += take;
          cloned.snapshot.economy.freedomTarget = Math.round(next.syndicate!.freedomThreshold * 0.7);
          cloned.snapshot.battle.bots = cloned.snapshot.battle.bots.map((bot) => ({ ...bot, heat: Math.max(bot.heat, 35) }));
          return cloned;
        });
        next.history.push({
          tick: next.tick,
          level: 'ALERT',
          channel: 'TEAM',
          actorId,
          code: 'DEFECTION_EXECUTED',
          message: `${actorId} defected and seized 40% of the treasury.`,
        });
      }
    } else if (actionId === 'PROOF_SHARE') {
      const actor = next.participants.find((participant) => participant.playerId === actorId);
      next.history.push({
        tick: next.tick,
        level: 'INFO',
        channel: 'TEAM',
        actorId,
        code: 'PROOF_SHARE',
        message: `${actorId} shared treasury / shield / income proof.`,
        payload: { proofHash: actor?.snapshot.sovereignty.proofHash ?? 'pending' },
      });
    }

    return next;
  }

  public finalize(frame: ModeFrame): ModeFinalization {
    return finalizeSyndicate(frame);
  }
}
