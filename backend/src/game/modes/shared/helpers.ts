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

import type { CardDecisionAudit, ModeEvent, ModeFrame, ModeParticipant, PsycheState, VisibilityTier } from '../contracts';
import type { CardDefinition, CardInstance, ModeCode, ShieldLayerId } from '../../engine/core/GamePrimitives';
import { MODE_TAG_WEIGHTS } from './constants';

/** Strips all readonly modifiers recursively, including converting readonly arrays to mutable arrays. */
type MutableDeep<T> =
  T extends ReadonlyArray<infer U>
    ? Array<MutableDeep<U>>
    : T extends object
    ? { -readonly [K in keyof T]: MutableDeep<T[K]> }
    : T;

export function deepClone<T>(value: T): MutableDeep<T> {
  return JSON.parse(JSON.stringify(value)) as MutableDeep<T>;
}

export function cloneParticipant(participant: ModeParticipant): ModeParticipant {
  return {
    ...participant,
    snapshot: {
      ...participant.snapshot,
      economy: { ...participant.snapshot.economy },
      pressure: { ...participant.snapshot.pressure },
      tension: {
        ...participant.snapshot.tension,
        visibleThreats: [...participant.snapshot.tension.visibleThreats],
      },
      shield: {
        ...participant.snapshot.shield,
        layers: participant.snapshot.shield.layers.map((layer) => ({ ...layer })),
      },
      battle: {
        ...participant.snapshot.battle,
        bots: participant.snapshot.battle.bots.map((bot) => ({ ...bot })),
        pendingAttacks: participant.snapshot.battle.pendingAttacks.map((attack) => ({ ...attack, notes: [...attack.notes] })),
      },
      cascade: {
        ...participant.snapshot.cascade,
        activeChains: participant.snapshot.cascade.activeChains.map((chain) => ({
          ...chain,
          links: chain.links.map((link) => ({ ...link })),
          recoveryTags: [...chain.recoveryTags],
        })),
        positiveTrackers: [...participant.snapshot.cascade.positiveTrackers],
        repeatedTriggerCounts: { ...participant.snapshot.cascade.repeatedTriggerCounts },
      },
      sovereignty: {
        ...participant.snapshot.sovereignty,
        tickChecksums: [...participant.snapshot.sovereignty.tickChecksums],
        proofBadges: [...participant.snapshot.sovereignty.proofBadges],
      },
      cards: {
        ...participant.snapshot.cards,
        hand: participant.snapshot.cards.hand.map((card) => ({ ...card, timingClass: [...card.timingClass], tags: [...card.tags] })),
        discard: [...participant.snapshot.cards.discard],
        exhaust: [...participant.snapshot.cards.exhaust],
        drawHistory: [...participant.snapshot.cards.drawHistory],
        lastPlayed: [...participant.snapshot.cards.lastPlayed],
        ghostMarkers: participant.snapshot.cards.ghostMarkers.map((marker) => ({ ...marker })),
      },
      modeState: {
        ...participant.snapshot.modeState,
        trustScores: { ...participant.snapshot.modeState.trustScores },
        roleAssignments: { ...participant.snapshot.modeState.roleAssignments },
        defectionStepByPlayer: { ...participant.snapshot.modeState.defectionStepByPlayer },
        handicapIds: [...participant.snapshot.modeState.handicapIds],
        disabledBots: [...participant.snapshot.modeState.disabledBots],
      },
      timers: {
        ...participant.snapshot.timers,
        activeDecisionWindows: { ...participant.snapshot.timers.activeDecisionWindows },
        frozenWindowIds: [...participant.snapshot.timers.frozenWindowIds],
      },
      telemetry: {
        ...participant.snapshot.telemetry,
        decisions: participant.snapshot.telemetry.decisions.map((decision) => ({ ...decision, timingClass: [...decision.timingClass] })),
        forkHints: [...participant.snapshot.telemetry.forkHints],
      },
      tags: [...participant.snapshot.tags],
    },
    counters: [...participant.counters],
    metadata: { ...participant.metadata },
  };
}

export function cloneFrame(frame: ModeFrame): ModeFrame {
  return {
    ...frame,
    participants: frame.participants.map(cloneParticipant),
    history: frame.history.map((entry) => ({ ...entry, payload: entry.payload ? { ...entry.payload } : undefined })),
    sharedThreats: frame.sharedThreats.map((threat) => ({ ...threat })),
    sharedOpportunitySlots: frame.sharedOpportunitySlots.map((slot) => ({ ...slot })),
    rivalry: frame.rivalry ? { ...frame.rivalry, wins: { ...frame.rivalry.wins }, carryHeatByPlayer: { ...frame.rivalry.carryHeatByPlayer } } : null,
    syndicate: frame.syndicate
      ? {
          ...frame.syndicate,
          freedPlayerIds: [...frame.syndicate.freedPlayerIds],
          defectedPlayerIds: [...frame.syndicate.defectedPlayerIds],
          trustAudit: Object.fromEntries(
            Object.entries(frame.syndicate.trustAudit).map(([key, line]) => [
              key,
              { ...line, notes: [...line.notes] },
            ]),
          ),
        }
      : null,
    legend: frame.legend
      ? {
          ...frame.legend,
          markers: frame.legend.markers.map((marker) => ({ ...marker })),
          challengerScores: [...frame.legend.challengerScores],
          challengerRunIds: [...frame.legend.challengerRunIds],
        }
      : null,
  };
}

export function updateParticipant(frame: ModeFrame, playerId: string, updater: (participant: ModeParticipant) => ModeParticipant): ModeFrame {
  const next = cloneFrame(frame);
  next.participants = next.participants.map((participant) => (participant.playerId === playerId ? updater(participant) : participant));
  return next;
}

export function pushEvent(frame: ModeFrame, event: ModeEvent): ModeFrame {
  const next = cloneFrame(frame);
  next.history.push(event);
  return next;
}

export function shieldPct(participant: ModeParticipant): number {
  const totalMax = participant.snapshot.shield.layers.reduce((sum, layer) => sum + layer.max, 0);
  const totalCurrent = participant.snapshot.shield.layers.reduce((sum, layer) => sum + layer.current, 0);
  return totalMax === 0 ? 0 : totalCurrent / totalMax;
}

export function weakestShieldLayerId(participant: ModeParticipant): ShieldLayerId {
  return participant.snapshot.shield.layers.reduce((weakest, current) => (current.current < weakest.current ? current : weakest)).layerId;
}

export function averageDecisionLatencyMs(participant: ModeParticipant): number {
  const decisions = participant.snapshot.telemetry.decisions;
  if (decisions.length === 0) return Number.MAX_SAFE_INTEGER;
  return decisions.reduce((sum, decision) => sum + decision.latencyMs, 0) / decisions.length;
}

export function addForkHint(participant: ModeParticipant, hint: string): ModeParticipant {
  const next = deepClone(participant);
  next.snapshot.telemetry.forkHints.push(hint);
  return next;
}

export function setTimerWindow(participant: ModeParticipant, windowId: string, ticksRemaining: number): ModeParticipant {
  const next = deepClone(participant);
  (next.snapshot.timers.activeDecisionWindows as unknown as Record<string, number>)[windowId] = ticksRemaining;
  return next;
}

export function countdownTimerWindows(participant: ModeParticipant): ModeParticipant {
  const next = deepClone(participant);
  const adw = next.snapshot.timers.activeDecisionWindows as unknown as Record<string, number>;
  const entries = Object.entries(adw)
    .map(([key, value]) => [key, Math.max(0, value - 1)] as const)
    .filter(([, value]) => value > 0);
  (next.snapshot.timers as unknown as { activeDecisionWindows: Record<string, number> }).activeDecisionWindows = Object.fromEntries(entries);
  return next;
}

export function cardToInstance(mode: ModeCode, card: CardDefinition, cost: number, targeting: CardInstance['targeting'], timingClass: CardInstance['timingClass']): CardInstance {
  return {
    instanceId: `${card.id}:${mode}`,
    definitionId: card.id,
    card,
    cost,
    targeting,
    timingClass,
    tags: [...card.tags],
    overlayAppliedForMode: mode,
    decayTicksRemaining: card.decayTicks ?? null,
    divergencePotential: mode === 'ghost' && card.tags.includes('divergence') ? 'HIGH' : 'LOW',
  };
}

export function modeTagWeight(mode: ModeCode, tag: string): number {
  return MODE_TAG_WEIGHTS[mode][tag] ?? 1.0;
}

export function visibilityForTier(counterIntelTier: number): VisibilityTier {
  return counterIntelTier >= 3 ? 'EXPOSED' : counterIntelTier === 2 ? 'TELEGRAPHED' : counterIntelTier === 1 ? 'SIGNALED' : 'SHADOWED';
}

export function calcPsycheState(participant: ModeParticipant): PsycheState {
  const shields = shieldPct(participant);
  const latency = averageDecisionLatencyMs(participant);
  const chains = participant.snapshot.cascade.activeChains.length;
  const cash = participant.snapshot.economy.cash;
  const tier = participant.snapshot.pressure.tier;
  if (cash < 3000 && shields < 0.2) return 'DESPERATE';
  if ((tier === 'T4' || tier === 'T3') && participant.snapshot.battle.battleBudget < 10) return 'BREAKING';
  if (shields < 0.4 && chains > 0 && latency > 2500) return 'CRACKING';
  if (shields < 0.5 || latency > 1800) return 'STRESSED';
  return 'COMPOSED';
}

export function auditCardDecision(
  actorId: string,
  cardId: string,
  mode: ModeCode,
  timingDeltaTicks: number,
  opportunityCost: number,
  notes: string[],
): CardDecisionAudit {
  const qualityScore = Math.max(0, Number((1 - timingDeltaTicks * 0.15 - opportunityCost / 10000).toFixed(4)));
  return {
    actorId,
    cardId,
    mode,
    qualityScore,
    timingDeltaTicks,
    opportunityCost,
    notes,
  };
}
