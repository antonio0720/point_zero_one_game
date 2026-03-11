//backend/src/game/engine/tension/__tests__/ThreatVisibilityManager.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';

import { ThreatVisibilityManager } from '../ThreatVisibilityManager';
import {
  TENSION_VISIBILITY_STATE,
  type TensionVisibilityState,
} from '../types';

describe('ThreatVisibilityManager', () => {
  let manager: ThreatVisibilityManager;

  beforeEach(() => {
    manager = new ThreatVisibilityManager();
  });

  function expectState(state: TensionVisibilityState): void {
    expect(manager.getCurrentState()).toBe(state);
  }

  it('starts at SHADOWED by default', () => {
    expectState(TENSION_VISIBILITY_STATE.SHADOWED);
    expect(manager.getPreviousState()).toBeNull();
    expect(manager.getPendingDowngrade()).toBeNull();
    expect(manager.getDowngradeCountdown()).toBe(0);
  });

  it('upgrades immediately to SIGNALED when pressure reaches T1', () => {
    const result = manager.update('T1', false);

    expect(result.state).toBe(TENSION_VISIBILITY_STATE.SIGNALED);
    expect(result.changed).toBe(true);
    expect(manager.getPreviousState()).toBe(TENSION_VISIBILITY_STATE.SHADOWED);
    expectState(TENSION_VISIBILITY_STATE.SIGNALED);
  });

  it('upgrades immediately to TELEGRAPHED when pressure reaches T2', () => {
    const result = manager.update('T2', false);

    expect(result.state).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    expect(result.changed).toBe(true);
    expectState(TENSION_VISIBILITY_STATE.TELEGRAPHED);
  });

  it('EXPOSED requires both T4 pressure and near-death state', () => {
    const withoutNearDeath = manager.update('T4', false);
    expect(withoutNearDeath.state).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);

    const withNearDeath = manager.update('T4', true);
    expect(withNearDeath.state).toBe(TENSION_VISIBILITY_STATE.EXPOSED);
    expectState(TENSION_VISIBILITY_STATE.EXPOSED);
  });

  it('downgrades from TELEGRAPHED to SIGNALED only after the two-tick delay completes', () => {
    manager.update('T2', false);
    expectState(TENSION_VISIBILITY_STATE.TELEGRAPHED);

    const firstDropTick = manager.update('T1', false);
    expect(firstDropTick.state).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    expect(firstDropTick.changed).toBe(false);
    expect(manager.getPendingDowngrade()).toBe(TENSION_VISIBILITY_STATE.SIGNALED);

    const secondDropTick = manager.update('T1', false);
    expect(secondDropTick.state).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    expect(secondDropTick.changed).toBe(false);

    const thirdDropTick = manager.update('T1', false);
    expect(thirdDropTick.state).toBe(TENSION_VISIBILITY_STATE.SIGNALED);
    expect(thirdDropTick.changed).toBe(true);
    expectState(TENSION_VISIBILITY_STATE.SIGNALED);
  });

  it('an upgrade cancels a pending downgrade', () => {
    manager.update('T2', false);
    expectState(TENSION_VISIBILITY_STATE.TELEGRAPHED);

    manager.update('T1', false);
    expect(manager.getPendingDowngrade()).toBe(TENSION_VISIBILITY_STATE.SIGNALED);

    const spike = manager.update('T4', true);
    expect(spike.state).toBe(TENSION_VISIBILITY_STATE.EXPOSED);
    expect(spike.changed).toBe(true);
    expect(manager.getPendingDowngrade()).toBeNull();
    expect(manager.getDowngradeCountdown()).toBe(0);
  });

  it('EXPOSED remains sticky for one tick after near-death resolves', () => {
    manager.update('T4', true);
    expectState(TENSION_VISIBILITY_STATE.EXPOSED);

    const stickyTick = manager.update('T4', false);
    expect(stickyTick.state).toBe(TENSION_VISIBILITY_STATE.EXPOSED);
    expect(stickyTick.changed).toBe(false);
    expectState(TENSION_VISIBILITY_STATE.EXPOSED);
  });

  it('counter-intel promotion can raise visibility one level without importing PressureEngine', () => {
    const result = manager.update('T1', false, 2);

    expect(result.state).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    expect(result.changed).toBe(true);
    expectState(TENSION_VISIBILITY_STATE.TELEGRAPHED);
  });

  it('counter-intel cannot promote beyond TELEGRAPHED unless near-death plus T4 unlocks EXPOSED', () => {
    const telegraphedOnly = manager.update('T0', false, 3);
    expect(telegraphedOnly.state).toBe(TENSION_VISIBILITY_STATE.TELEGRAPHED);

    manager.reset();

    const exposed = manager.update('T4', true, 3);
    expect(exposed.state).toBe(TENSION_VISIBILITY_STATE.EXPOSED);
  });

  it('a collapse from T2 to T0 degrades one state at a time rather than flickering to SHADOWED instantly', () => {
    manager.update('T2', false);
    expectState(TENSION_VISIBILITY_STATE.TELEGRAPHED);

    manager.update('T0', false);
    manager.update('T0', false);
    const firstResolvedStep = manager.update('T0', false);

    expect(firstResolvedStep.state).toBe(TENSION_VISIBILITY_STATE.SIGNALED);
    expectState(TENSION_VISIBILITY_STATE.SIGNALED);

    manager.update('T0', false);
    manager.update('T0', false);
    const secondResolvedStep = manager.update('T0', false);

    expect(secondResolvedStep.state).toBe(TENSION_VISIBILITY_STATE.SHADOWED);
    expectState(TENSION_VISIBILITY_STATE.SHADOWED);
  });

  it('reset clears all visibility state and downgrade bookkeeping', () => {
    manager.update('T4', true);
    manager.update('T1', false);

    manager.reset();

    expectState(TENSION_VISIBILITY_STATE.SHADOWED);
    expect(manager.getPreviousState()).toBeNull();
    expect(manager.getPendingDowngrade()).toBeNull();
    expect(manager.getDowngradeCountdown()).toBe(0);
  });
});