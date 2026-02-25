import { TimeEngine } from '../engines/time/TimeEngine';
import { createTestEngine } from './testUtils';

describe('TimeEngine Edge Cases', () => {
  let engine: TimeEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  // Rule: No season manifest behavior
  test('No Season Manifest Behavior - Season remains unchanged when no manifest update is triggered', () => {
    const initialSeason = engine.currentSeason;
    engine.applyAction({ type: 'season', season: 'winter' });
    expect(engine.currentSeason).toBe(initialSeason);
  });

  // Rule: Overlapping multiplier stacking
  test('Overlapping Multiplier Stacking - Multipliers should stack when active simultaneously', () => {
    engine.applyAction({ type: 'multiplier', value: 1.5 });
    engine.applyAction({ type: 'multiplier', value: 2.0 });
    expect(engine.currentMultiplier).toBe(3.0);
  });

  // Rule: Tier-no-change no interpolation reset
  test('Tier-No-Change No Interpolation Reset - State should not reset when tier remains unchanged', () => {
    engine.applyAction({ type: 'tier', tier: 2 });
    engine.apply,applyAction({ type: 'tier', tier: 2 });
    expect(engine.currentTier).toBe(2);
    expect(engine.interpolationState).toBe('unchanged');
  });

  // Rule: Retransition from currentDuration
  test('Retransition from CurrentDuration - Duration should persist during retransition', () => {
    engine.applyAction({ type: 'duration', duration: 120 });
    engine.retransition();
    expect(engine.currentDuration).toBe(120);
  });

  // Rule: Run-end window discard
  test('Run-End Window Discard - Active windows should be cleared at run end', () => {
    engine.applyAction({ type: 'window', window: 'alpha' });
    engine.endRun();
    expect(engine.activeWindows).toBeEmpty();
  });

  // Rule: Single-hold-per-run
  test('Single-Hold-Per-Run - Only one hold allowed per run', () => {
    engine.applyAction({ type: 'hold', hold: 'beta' });
    engine.applyAction({ type: 'hold', hold: 'gamma' });
    expect(engine.activeHolds).toHaveLength(1);
  });
});
