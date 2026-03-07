// pzo-web/src/engines/core/__tests__/EngineOrchestrator.timeIntegration.test.ts
import { beforeEach, describe, it, vi } from 'vitest';
import { EventBus } from 'pzo-web/src/engines/core/EventBus';
import { TimeEngine } from 'pzo-web/src/engines/time/TimeEngine';
import { TICK_TIER_CHANGED } from 'pzo-web/src/engines/core/EventBus';

describe('EngineOrchestrator Time Integration Tests', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;
  
  beforeEach(() => {
    eventBus = new EventBus();
    timeEngine = new TimeEngine(eventBus);
    
    // Mock setTimeout to control timeout behavior
    vi.useFakeTimers();
  });

  it('should not emit TICK_TIER_CHANGED when tier remains unchanged', () => {
    // Arrange
    const mockEmit = vi.spyOn(eventBus, 'emit');
    const currentTier = 2;
    timeEngine.currentTier = currentTier;
    
    // Act
    timeEngine.setTierFromPressure(currentTier);
    
    // Assert
    expect(mockEmit).not.toHaveBeenCalledWith(TICK_TIER_CHANGED, expect.anything());
  });

  it('should trigger endRun after timeout when no steps are processed', () => {
    // Arrange
    vi.spyOn(timeEngine, 'processStep').mockImplementation(() => {});
    vi.spyOn(timeEngine, 'endRun').mockImplementation(() => {});
    
    // Act
    timeEngine.startRun();
    vi.runAllTimers();
    
    // Assert
    expect(timeEngine.endRun).toHaveBeenCalled();
  });

  it('should flush events after step processing', () => {
    // Arrange
    const mockEmit = vi.spyOn(eventBus, 'emit');
    timeEngine.processStep();
    
    // Act
    vi.runAllTimers();
    
    // Assert
    expect(mockEmit).toHaveBeenCalledWith(TICK_TIER_CHANGED, expect.anything());
  });
});
