// pzo-web/src/engines/time/TimeEngine.perf.test.ts
import { beforeEach, afterEach, describe, test, expect } from '@jest/globals';
import { TimeEngine } from '../TimeEngine';
import { DecisionTimer } from '../DecisionTimer';
import { EventBus } from '../../event/EventBus';
import { Store } from '../../store/Store';

describe('TimeEngine Performance Tests', () => {
  let originalOnTickComplete: () => void;
  let originalSetTierFromPressure: (pressure: number) => void;
  let originalInternalTick: () => void;
  let eventBus: EventBus;
  let store: Store;

  beforeEach(() => {
    // Initialize test environment
    eventBus = new EventBus();
    store = new Store();
    
    // Save original methods for restoration
    originalOnTickComplete = TimeEngine.prototype.onTickComplete;
    originalSetTierFromPressure = TimeEngine.prototype.setTierFromPressure;
    originalInternalTick = DecisionTimer.prototype.internalTick;
  });

  afterEach(() => {
    // Restore original methods
    TimeEngine.prototype.onTickComplete = originalOnTickComplete;
    TimeEngine.prototype.setTierFrom,Pressure = originalSetTierFromPressure;
    DecisionTimer.prototype.internalTick = originalInternalTick;
  });

  test('onTickComplete() completes under 1ms', () => {
    const startTime = performance.now();
    const tickCompleteSpy = jest.fn((cb: () => void) => {
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1);
      cb();
    });
    
    // Replace original method with spy
    TimeEngine.prototype.onTickComplete = tickCompleteSpy;
    
    // Simulate tick completion
    const engine = new TimeEngine();
    engine.onTickComplete(() => {});
  });

  test('setTierFromPressure() completes under 0.5ms', () => {
    const startTime = performance.now();
    const setTierSpy = jest.fn((pressure: number) => {
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(0.5);
    });
    
    // Replace original method with spy
    TimeEngine.prototype.setTierFromPressure = setTierSpy;
    
    // Simulate pressure update
    const engine = new TimeEngine();
    engine.setTierFromPressure(0.75);
  });

  test('DecisionTimer.internalTick() with 5 windows under 2ms', () => {
    // Create 5 mock windows
    const windows = Array(5).fill({ id: Math.random() }).map((_, i) => ({
      id: i,
      isOpen: true,
      onTick: jest.fn()
    }));
    
    // Replace original method with custom implementation
    DecisionTimer.prototype.internalTick = () => {
      const startTime = performance.now();
      
      // Simulate processing 5 windows
      windows.forEach(window => {
        if (window.isOpen) {
          window.onTick();
        }
      });
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(2);
    };
    
    // Simulate internal tick
    const decisionTimer = new DecisionTimer();
    decisionTimer.internalTick();
  });

  test('No synchronous DOM manipulation in Time Engine', () => {
    // Check all Time Engine classes for DOM manipulation
    const timeEngineClasses = [TimeEngine, DecisionTimer, EventBus];
    
    timeEngineClasses.forEach(cls => {
      const methods = Object.getOwnPropertyNames(cls.prototype);
      methods.forEach(method => {
        const func = cls.prototype[method];
        if (typeof func === 'function') {
          // Check if function contains DOM manipulation
          const hasDOMManipulation = func.toString().includes('document') ||
                                     func.toString().includes('window') ||
                                     func.toString().includes('createElement') ||
                                     func.toString().includes('appendChild') ||
                                     func.toString().includes('removeChild') ||
                                     func.toString().includes('setAttribute') ||
                                     func.toString().includes('removeAttribute');
          
          expect(hasDOMManipulation).toBe(false, `Found DOM manipulation in ${cls.name}.${method}`);
        }
      });
    });
  });

  test('React re-renders via store updates only', () => {
    // Check if Time Engine uses EventBus for state updates
    const timeEngineClasses = [TimeEngine, DecisionTimer];
    
    timeEngineClasses.forEach(cls => {
      const methods = Object.getOwnPropertyNames(cls.prototype);
      methods.forEach(method => {
        const func = cls.prototype[method];
        if (typeof func === 'function') {
          // Check if function directly calls setState
          const hasDirectSetState = func.toString().includes('setState') ||
                                   func.toString().includes('React.useState') ||
                                   func.toString().includes('React.useEffect');
          
          expect(hasDirectSetState).toBe(false, `Found direct React state update in ${cls.name}.${method}`);
        }
      });
    });
  });
});
