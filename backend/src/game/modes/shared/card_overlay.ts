/*
 * POINT ZERO ONE — BACKEND MODES 15X GENERATOR
 * Generated at: 2026-03-10T01:26:02.003447+00:00
 * backend/src/game/modes/shared/card_overlay.ts
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 */

import type { CardDefinition, CardInstance, DeckType, Targeting, TimingClass } from '../../engine/core/GamePrimitives';
import type { CardPlayIntent, ModeFrame, ModeValidationResult } from '../contracts';
import { CARD_LEGALITY, GHOST_WINDOW_RADIUS, MODE_TIMING_LOCKS, MODE_TAG_WEIGHTS } from './constants';
import { cardToInstance } from './helpers';

function isDeckLegal(mode: ModeFrame['mode'], deckType: DeckType): boolean {
  return CARD_LEGALITY[mode].includes(deckType);
}

function timingAllowed(frame: ModeFrame, intent: CardPlayIntent): boolean {
  const timing = intent.timing;
  if (timing === 'PHZ') return frame.participants.some((participant) => participant.snapshot.modeState.phaseBoundaryWindowsRemaining > 0);
  if (timing === 'CTR') return frame.participants.some((participant) => participant.metadata['incomingExtractionUntilTick'] === frame.tick);
  if (timing === 'AID') return frame.participants.some((participant) => participant.metadata['aidRequestOpen'] === true);
  if (timing === 'RES') return frame.participants.some((participant) => participant.snapshot.pressure.tier === 'T4');
  if (timing === 'GBM') {
    const actor = frame.participants.find((participant) => participant.playerId === intent.actorId);
    if (!actor) return false;
    return actor.snapshot.cards.ghostMarkers.some((marker) => Math.abs(marker.tick - frame.tick) <= GHOST_WINDOW_RADIUS);
  }
  return true;
}

function targetForMode(mode: ModeFrame['mode'], card: CardDefinition): Targeting {
  if (mode === 'pvp' && (card.deckType === 'SABOTAGE' || card.deckType === 'BLUFF')) return 'OPPONENT';
  if (mode === 'coop' && (card.deckType === 'AID' || card.deckType === 'RESCUE' || card.deckType === 'TRUST')) return 'TEAMMATE';
  return card.targeting;
}

export function applyModeOverlay(frame: ModeFrame, card: CardDefinition): CardInstance {
  const tagWeights = MODE_TAG_WEIGHTS[frame.mode];
  const positiveWeight = card.tags.reduce((sum, tag) => sum + (tagWeights[tag] ?? 1), 0) / Math.max(1, card.tags.length);
  const deckPenalty = frame.mode === 'pvp' && ['OPPORTUNITY', 'IPA', 'PRIVILEGED'].includes(card.deckType) ? 1.15 : 1.0;
  const teamDiscount = frame.mode === 'coop' && ['AID', 'RESCUE', 'TRUST'].includes(card.deckType) ? 0.9 : 1.0;
  const predatorDebuff = frame.mode === 'pvp' && card.tags.includes('income') ? 0.8 : 1.0;
  const ghostNeutral = frame.mode === 'ghost' ? 1.0 : 1.0;
  const cost = Math.max(0, Math.round(card.baseCost * deckPenalty * teamDiscount));
  const targeting = targetForMode(frame.mode, card);
  const timingLocks = MODE_TIMING_LOCKS[frame.mode];
  const timingClass = [...new Set([...card.timingClass, ...timingLocks.filter((timing) => card.tags.includes(timing.toLowerCase()))])];
  const instance = cardToInstance(frame.mode, card, cost, targeting, timingClass);
  instance.tags = [...card.tags];
  instance.decayTicksRemaining = frame.mode === 'ghost' ? Math.max(1, card.decayTicks ?? 3) : card.decayTicks ?? null;
  instance.divergencePotential =
    frame.mode === 'ghost' && card.tags.includes('divergence')
      ? 'HIGH'
      : frame.mode === 'ghost' && card.tags.includes('precision')
        ? 'MEDIUM'
        : 'LOW';
  instance.card = {
    ...card,
    baseEffect: {
      ...card.baseEffect,
      cashDelta: typeof card.baseEffect.cashDelta === 'number' ? Math.round(card.baseEffect.cashDelta * positiveWeight * predatorDebuff * ghostNeutral) : card.baseEffect.cashDelta,
      incomeDelta: typeof card.baseEffect.incomeDelta === 'number' ? Math.round(card.baseEffect.incomeDelta * positiveWeight * predatorDebuff * ghostNeutral) : card.baseEffect.incomeDelta,
      shieldDelta: typeof card.baseEffect.shieldDelta === 'number' ? Math.round(card.baseEffect.shieldDelta * positiveWeight) : card.baseEffect.shieldDelta,
    },
  };
  return instance;
}

export function validateModeCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
  const card = 'card' in intent.card ? intent.card.card : intent.card;
  const warnings: string[] = [];
  if (!isDeckLegal(frame.mode, card.deckType)) {
    return { ok: false, reason: `${card.deckType} is not legal in ${frame.mode}`, warnings };
  }
  if (card.modeLegal.length > 0 && !card.modeLegal.includes(frame.mode)) {
    return { ok: false, reason: `Card ${card.id} is not mode legal`, warnings };
  }
  if (!timingAllowed(frame, intent)) {
    return { ok: false, reason: `Timing window ${intent.timing} is closed`, warnings };
  }
  if (frame.mode === 'solo' && intent.targetId && intent.targetId !== intent.actorId) {
    return { ok: false, reason: 'Solo cards cannot target another participant', warnings };
  }
  if (frame.mode === 'pvp' && card.deckType === 'COUNTER' && !frame.participants.some((participant) => participant.metadata['incomingExtractionUntilTick'] === frame.tick)) {
    return { ok: false, reason: 'Counter card requires an active counter window', warnings };
  }
  if (frame.mode === 'coop' && ['AID', 'RESCUE', 'TRUST'].includes(card.deckType) && !intent.targetId) {
    return { ok: false, reason: 'Co-op support cards require a teammate target', warnings };
  }
  if (frame.mode === 'ghost' && card.deckType === 'GHOST') {
    const actor = frame.participants.find((participant) => participant.playerId === intent.actorId);
    const nearMarker = actor?.snapshot.cards.ghostMarkers.some((marker) => Math.abs(marker.tick - frame.tick) <= GHOST_WINDOW_RADIUS) ?? false;
    if (!nearMarker) return { ok: false, reason: 'Ghost cards require a legend marker window', warnings };
  }
  if (card.autoResolve) warnings.push('Card is auto-resolve; backend will settle it without client timing trust.');
  return { ok: true, reason: null, warnings };
}
