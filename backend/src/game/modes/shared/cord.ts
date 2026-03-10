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

import type { ModeFinalization, ModeFrame, ModeParticipant } from '../contracts';
import { averageDecisionLatencyMs, calcPsycheState, shieldPct } from './helpers';

function hasFreedom(participant: ModeParticipant): boolean {
  return participant.snapshot.outcome === 'FREEDOM';
}

function dormantBotCount(participant: ModeParticipant): number {
  return participant.snapshot.battle.bots.filter((bot) => bot.state === 'DORMANT' || bot.neutralized).length;
}

function noHoldUsed(participant: ModeParticipant): boolean {
  return participant.snapshot.timers.holdCharges === 1 || participant.snapshot.tags.includes('NO_HOLD_USED');
}

function optionsPurchased(participant: ModeParticipant): number {
  return participant.snapshot.economy.opportunitiesPurchased;
}

function privilegePlays(participant: ModeParticipant): number {
  return participant.snapshot.economy.privilegePlays;
}

export function finalizeEmpire(frame: ModeFrame): ModeFinalization {
  const participant = frame.participants[0];
  let bonusMultiplier = 1.0;
  let flatBonus = 0;
  const badges: string[] = [];
  const notes: string[] = [];
  if (participant.snapshot.telemetry.decisions.filter((decision) => decision.latencyMs < 2000).length >= 3) {
    bonusMultiplier += 0.40;
    badges.push('CLUTCH');
  }
  if (noHoldUsed(participant)) {
    bonusMultiplier += 0.25;
    badges.push('NO_HOLD_RUN');
  }
  if (optionsPurchased(participant) >= 3 && participant.snapshot.cards.lastPlayed.every((cardId) => !cardId.includes('FUBAR'))) {
    bonusMultiplier += 0.30;
    badges.push('SOVEREIGN_SWEEP');
  }
  if ((participant.metadata['bleedMode'] === true || participant.snapshot.modeState.bleedMode) && hasFreedom(participant)) {
    bonusMultiplier += 0.80;
    badges.push('BLEED_RUN');
  }
  if (dormantBotCount(participant) >= 5) {
    bonusMultiplier += 0.50;
    badges.push('EXTERMINATOR');
  }
  if (participant.metadata['comebackFreedom'] === true) {
    flatBonus += 0.05;
    badges.push('COMEBACK_SOVEREIGN');
  }
  notes.push(`Average decision latency=${averageDecisionLatencyMs(participant).toFixed(0)}ms`);
  return { bonusMultiplier, flatBonus, badges, audits: [], notes };
}

export function finalizePredator(frame: ModeFrame): ModeFinalization {
  let bonusMultiplier = 1.0;
  let flatBonus = 0;
  const badges: string[] = [];
  const notes: string[] = [];
  const winner = [...frame.participants].sort((a, b) => b.snapshot.sovereignty.sovereigntyScore - a.snapshot.sovereignty.sovereigntyScore)[0];
  if (winner.metadata['firstBlood'] === true) {
    bonusMultiplier += 0.15;
    badges.push('FIRST_BLOOD');
  }
  const loser = frame.participants.find((participant) => participant.playerId !== winner.playerId);
  if (loser?.snapshot.outcome === 'BANKRUPT' && frame.tick < 400) {
    bonusMultiplier += 0.40;
    badges.push('ECONOMIC_ANNIHILATION');
  }
  if ((winner.metadata['counterSuccessCount'] as number | undefined ?? 0) >= 3) {
    bonusMultiplier += 0.35;
    badges.push('PERFECT_COUNTER');
  }
  if (frame.rivalry?.matchesPlayed && frame.rivalry.matchesPlayed >= 3) notes.push('Rivalry ledger active.');
  return { bonusMultiplier, flatBonus, badges, audits: [], notes };
}

export function finalizeSyndicate(frame: ModeFrame): ModeFinalization {
  let bonusMultiplier = 1.0;
  let flatBonus = 0;
  const badges: string[] = [];
  const notes: string[] = [];
  if (frame.syndicate?.defectedPlayerIds.length && frame.syndicate.freedPlayerIds.length) {
    bonusMultiplier += 0.60;
    badges.push('BETRAYAL_SURVIVOR');
  }
  if (
    frame.participants.length >= 4 &&
    frame.participants.every((participant) => participant.roleId) &&
    frame.participants.every(hasFreedom)
  ) {
    bonusMultiplier += 0.45;
    badges.push('FULL_SYNERGY');
  }
  const absorber = frame.participants.find((participant) => (participant.metadata['cascadeAbsorptions'] as number | undefined ?? 0) >= 3);
  if (absorber) {
    bonusMultiplier += 0.35;
    badges.push('CASCADE_ABSORBER');
  }
  const champion = [...frame.participants].sort((a, b) => b.snapshot.sovereignty.sovereigntyScore - a.snapshot.sovereignty.sovereigntyScore)[0];
  if (champion) {
    bonusMultiplier += 0.25;
    badges.push('SYNDICATE_CHAMPION');
    notes.push(`Champion=${champion.playerId}`);
  }
  return { bonusMultiplier, flatBonus, badges, audits: [], notes };
}

export function finalizePhantom(frame: ModeFrame): ModeFinalization {
  const participant = frame.participants[0];
  let bonusMultiplier = 1.0;
  let flatBonus = 0;
  const badges: string[] = [];
  const notes: string[] = [];
  const legendScore = frame.legend?.legendScore ?? 0;
  const delta = participant.snapshot.sovereignty.sovereigntyScore - legendScore;
  if (delta > legendScore * 0.15) {
    bonusMultiplier += 0.20;
    badges.push('GHOST_SLAYER');
  }
  if (delta > legendScore * 0.20) {
    bonusMultiplier += 0.75;
    badges.push('LEGEND_GAP');
  }
  if ((frame.legend?.challengerScores.length ?? 0) >= 3 && participant.snapshot.sovereignty.sovereigntyScore > Math.max(...(frame.legend?.challengerScores ?? [0]), legendScore)) {
    bonusMultiplier += 1.00;
    badges.push('DYNASTY');
  }
  if ((frame.legend?.daysAlive ?? 0) >= 30 && delta > 0) {
    bonusMultiplier += 0.55;
    badges.push('IRON_GHOST');
  }
  if (participant.metadata['tookFubarHit'] === true && delta > 0) badges.push('FUBAR_CHAMPION');
  if (privilegePlays(participant) === 0 && hasFreedom(participant)) badges.push('CLEAN_RUN');
  if ((participant.metadata['cardPlays'] as number | undefined ?? 0) < (participant.metadata['legendCardPlays'] as number | undefined ?? Number.MAX_SAFE_INTEGER)) badges.push('MINIMALIST');
  if ((participant.metadata['ghostSyncCount'] as number | undefined ?? 0) >= 5) badges.push('GHOST_SYNCED');
  if ((participant.metadata['cashFloor'] as number | undefined ?? Number.MAX_SAFE_INTEGER) < 3000 && delta > 0) badges.push('COMEBACK_LEGEND');
  notes.push(`Gap delta=${delta.toFixed(4)} psyche=${calcPsycheState(participant)}`);
  return { bonusMultiplier, flatBonus, badges, audits: [], notes };
}
