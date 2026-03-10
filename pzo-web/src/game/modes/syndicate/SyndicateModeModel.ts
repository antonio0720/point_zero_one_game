import type { BaseCardLike, EngineSnapshotLike, EventFeedItem, FrontendModeAdapter, FrontendModeState, TeamPlayerState, TrustBand, SyndicateProjection } from '../contracts';
import { MODE_TO_CODE, MODE_TO_LABEL, MODE_TO_SCREEN, SYNDICATE_RULES } from '../shared/constants';
import { applyModeOverlays } from '../shared/cardOverlay';
import { projectCORD } from '../shared/cord';
import { classifyTrustBand, safeNumber, toPrimaryBars, toShieldBars } from '../shared/helpers';

export class SyndicateModeModel implements FrontendModeAdapter {
  readonly runMode = 'co-op' as const;
  readonly modeCode = MODE_TO_CODE['co-op'];
  readonly uiLabel = MODE_TO_LABEL['co-op'];
  readonly screenName = MODE_TO_SCREEN['co-op'];

  bootstrap(snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    return this.reduce(emptyState(this), snapshot, cards);
  }

  reduce(prev: FrontendModeState, snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    const roles = snapshot.team?.players ?? [];
    const trustBand = classifyTrustBand(avgTrust(snapshot));
    const runtimeCards = applyModeOverlays(cards, {
      mode: 'co-op',
      trustScore: avgTrust(snapshot),
      pressureTierMultiplier: snapshot.pressureTier === 'T4' ? 1.12 : snapshot.pressureTier === 'T3' ? 1.06 : 1,
    });
    const syndicate: SyndicateProjection = {
      treasury: snapshot.team?.treasury ?? snapshot.cash,
      treasuryCritical: (snapshot.team?.treasury ?? snapshot.cash) < SYNDICATE_RULES.treasuryCriticalFloor,
      trustBand,
      synergyActive: hasFullRoleSet(roles),
      warAlert: safeNumber(snapshot.team?.criticalAlerts, 0) > 0 || roles.some(player => player.personalPressureTier === 'T4'),
      defectionRisk: computeDefectionRisk(roles),
      roles,
      proofShareReady: snapshot.tick > 0,
    };
    return {
      runMode: this.runMode,
      modeCode: this.modeCode,
      uiLabel: this.uiLabel,
      screenName: this.screenName,
      tick: snapshot.tick,
      elapsedMs: snapshot.elapsedMs,
      totalRunMs: snapshot.totalRunMs,
      pressureTier: snapshot.pressureTier,
      shieldBars: toShieldBars(snapshot),
      primaryBars: toPrimaryBars({ ...snapshot, cash: syndicate.treasury, netWorth: snapshot.netWorth }),
      eventFeed: appendEvents(prev.eventFeed, buildSyndicateEvents(snapshot, syndicate)),
      cord: projectCORD('co-op', snapshot, {
        betrayalSurvivor: roles.some(player => player.defected) && snapshot.netWorth >= snapshot.freedomThreshold,
        fullSynergy: syndicate.synergyActive && roles.every(role => role.freedom),
        cascadeAbsorber: safeNumber(snapshot.cascadeChainsBroken, 0) >= 3,
      }),
      runtimeCards,
      syndicate,
    };
  }
}

function emptyState(model: SyndicateModeModel): FrontendModeState {
  return {
    runMode: model.runMode,
    modeCode: model.modeCode,
    uiLabel: model.uiLabel,
    screenName: model.screenName,
    tick: 0,
    elapsedMs: 0,
    totalRunMs: 12 * 60_000,
    pressureTier: 'T1',
    shieldBars: [],
    primaryBars: [],
    eventFeed: [],
    cord: projectCORD('co-op', {
      runId: 'bootstrap',
      seed: 'bootstrap',
      tick: 0,
      elapsedMs: 0,
      totalRunMs: 12 * 60_000,
      cash: 0,
      netWorth: 0,
      incomePerTick: 0,
      expensePerTick: 0,
      freedomThreshold: 180_000,
      pressureTier: 'T1',
      shields: { L1: 100, L2: 100, L3: 100, L4: 100 },
    }),
    runtimeCards: [],
  };
}

function avgTrust(snapshot: EngineSnapshotLike): number {
  const trustScores = Object.values(snapshot.team?.trustScores ?? {});
  if (trustScores.length === 0) return 50;
  return trustScores.reduce((sum, value) => sum + value, 0) / trustScores.length;
}

function hasFullRoleSet(roles: TeamPlayerState[]): boolean {
  return new Set(roles.map(role => role.role)).size >= 4;
}

function computeDefectionRisk(roles: TeamPlayerState[]): number {
  if (roles.length === 0) return 0;
  const averageTrust = roles.reduce((sum, role) => sum + role.trustScore, 0) / roles.length;
  const defectedPenalty = roles.some(role => role.defected) ? 25 : 0;
  return Math.max(0, Math.min(100, Math.round(100 - averageTrust + defectedPenalty)));
}

function buildSyndicateEvents(snapshot: EngineSnapshotLike, projection: SyndicateProjection): EventFeedItem[] {
  const items: EventFeedItem[] = [];
  if (projection.synergyActive) {
    items.push({ id: `syndicate-synergy-${snapshot.tick}`, tick: snapshot.tick, title: 'Role Synergy Active', body: 'All four roles present. Team-wide shield boost is live.', severity: 'success', lane: 'team' });
  }
  if (projection.warAlert) {
    items.push({ id: `syndicate-alert-${snapshot.tick}`, tick: snapshot.tick, title: 'War Alert', body: 'A teammate is under CRITICAL pressure. Rescue tempo now matters more than efficiency.', severity: 'danger', lane: 'team' });
  }
  if (projection.treasuryCritical) {
    items.push({ id: `syndicate-treasury-${snapshot.tick}`, tick: snapshot.tick, title: 'Critical Treasury', body: 'Team treasury is below the critical floor. Shield regen is impaired until recovery.', severity: 'warn', lane: 'team' });
  }
  if (projection.defectionRisk >= 45) {
    items.push({ id: `syndicate-defection-${snapshot.tick}`, tick: snapshot.tick, title: 'Defection Risk Rising', body: 'Trust decay suggests authored betrayal is now plausible. Watch sequence-heavy card behavior.', severity: 'warn', lane: 'team' });
  }
  return items;
}

function appendEvents(prev: EventFeedItem[], next: EventFeedItem[]): EventFeedItem[] {
  return [...prev, ...next].slice(-18);
}
