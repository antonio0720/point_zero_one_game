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

import type { CardDefinition, ModeCode, RunOutcome } from '../engine/core/GamePrimitives';
import type { CardPlayIntent, ModeFinalization, ModeFrame, ModeParticipant } from './contracts';
import { getModeAdapter } from './ModeRegistry';
import { auditCardDecision, cloneFrame } from './shared/helpers';

export interface CreateFrameOptions {
  mode: ModeCode;
  tick?: number;
  participants: ModeParticipant[];
  legend?: ModeFrame['legend'];
  rivalry?: ModeFrame['rivalry'];
  syndicate?: ModeFrame['syndicate'];
  sharedOpportunitySlots?: ModeFrame['sharedOpportunitySlots'];
  sharedThreats?: ModeFrame['sharedThreats'];
}

export class ModeRuntimeDirector {
  public createFrame(options: CreateFrameOptions): ModeFrame {
    return {
      mode: options.mode,
      tick: options.tick ?? 0,
      participants: options.participants,
      history: [],
      sharedThreats: options.sharedThreats ?? [],
      sharedOpportunitySlots: options.sharedOpportunitySlots ?? [],
      rivalry: options.rivalry ?? null,
      syndicate: options.syndicate ?? null,
      legend: options.legend ?? null,
    };
  }

  public bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame {
    return getModeAdapter(frame.mode).bootstrap(frame, options);
  }

  public processTick(frame: ModeFrame): ModeFrame {
    const adapter = getModeAdapter(frame.mode);
    let next = adapter.onTickStart(frame);
    next = cloneFrame(next);
    next.tick += 1;
    next.participants = next.participants.map((participant) => ({
      ...participant,
      snapshot: {
        ...participant.snapshot,
        tick: next.tick,
        timers: {
          ...participant.snapshot.timers,
          elapsedMs: participant.snapshot.timers.elapsedMs + participant.snapshot.timers.currentTickDurationMs,
        },
      },
    }));
    next = adapter.onTickEnd(next);
    return next;
  }

  public projectCard(frame: ModeFrame, actorId: string, card: CardDefinition) {
    return getModeAdapter(frame.mode).applyCardOverlay(frame, actorId, card);
  }

  public validateCardPlay(frame: ModeFrame, intent: CardPlayIntent) {
    return getModeAdapter(frame.mode).validateCardPlay(frame, intent);
  }

  public resolveNamedAction(frame: ModeFrame, actorId: string, actionId: string, payload?: Record<string, unknown>) {
    return getModeAdapter(frame.mode).resolveNamedAction(frame, actorId, actionId, payload);
  }

  public recordCardDecision(
    frame: ModeFrame,
    actorId: string,
    cardId: string,
    timingDeltaTicks: number,
    opportunityCost: number,
    notes: string[],
  ): ModeFrame {
    const next = cloneFrame(frame);
    const audit = auditCardDecision(actorId, cardId, next.mode, timingDeltaTicks, opportunityCost, notes);
    next.history.push({
      tick: next.tick,
      level: audit.qualityScore >= 0.8 ? 'SUCCESS' : audit.qualityScore >= 0.55 ? 'INFO' : 'WARNING',
      channel: next.mode === 'coop' ? 'TEAM' : 'SYSTEM',
      actorId,
      code: 'CARD_DECISION_AUDIT',
      message: `Card ${cardId} quality=${audit.qualityScore.toFixed(3)} timingDelta=${timingDeltaTicks}`,
      payload: { qualityScore: audit.qualityScore, opportunityCost },
    });
    return next;
  }

  public finalize(frame: ModeFrame, outcomes?: Partial<Record<string, RunOutcome>>): { frame: ModeFrame; finalization: ModeFinalization } {
    let next = cloneFrame(frame);
    if (outcomes) {
      next.participants = next.participants.map((participant) => ({
        ...participant,
        snapshot: {
          ...participant.snapshot,
          outcome: outcomes[participant.playerId] ?? participant.snapshot.outcome,
        },
      }));
    }
    const finalization = getModeAdapter(next.mode).finalize(next);
    next.participants = next.participants.map((participant) => ({
      ...participant,
      snapshot: {
        ...participant.snapshot,
        sovereignty: {
          ...participant.snapshot.sovereignty,
          sovereigntyScore: Number((participant.snapshot.sovereignty.sovereigntyScore * finalization.bonusMultiplier + finalization.flatBonus).toFixed(6)),
          proofBadges: [...new Set([...participant.snapshot.sovereignty.proofBadges, ...finalization.badges])],
        },
      },
    }));
    next.history.push({
      tick: next.tick,
      level: 'SUCCESS',
      channel: 'SYSTEM',
      actorId: null,
      code: 'MODE_FINALIZED',
      message: `Mode ${next.mode} finalized with bonusMultiplier=${finalization.bonusMultiplier.toFixed(2)} flatBonus=${finalization.flatBonus.toFixed(2)}.`,
    });
    return { frame: next, finalization };
  }
}
