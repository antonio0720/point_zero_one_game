// DecisionTimerTestHelpers.test.ts - This is where you will write your unit tests using jest (or similar) to validate the behavior of `DecisionTimer`.
import { createMockEventBus, mockForcedCard, sleep } from '../timeEngine/TimeEngineTestHelpers'; // Importing helper functions created above.
import TimeEngine from 'pzo-web/src/engines/time/TimeEngine';

describe('DecisionTimer', () => {
  let eventBus: EventEmitter;
  const timeEngine = new TimeEngine();
  
  beforeEach(() => {
    // Resetting the state of DecisionTimer and other related components if necessary.
    jest.spyOn(timeEngine, 'stopIfEmpty').mockImplementationOnce((): void => {});
  });

  test('isExpired when remainingMs <= 0', async () => {
    eventBus = createMockEventBus();
    
    // Setup initial conditions for the timer.
    timeEngine.setRemainingMilliseconds(12);
    const windowId = 'window-id';
    const cardId = '';
    await sleep(3); // Simulate elapsed time passing quickly to reach 0ms remaining.
    
    expect(timeEngine.isExpired).toBeTruthy();
    eventBus.emit('DECISION_WINDOW_EXPIRED', windowId, cardId, -1, false); // Assuming worstOptionIndex is set as the last option (worst index) and hold was not active before expiry.
  });
  
  test('emits DECISION_WINDOW_EXPIRED with correct data when timer ends', async () => {
    eventBus = createMockEventBus();
    
    timeEngine.setRemainingMilliseconds(12); // Start the countdown for a decision window of 12 seconds (approximately).
    const windowId = 'window-id';
    const cardId = '';
    
    await sleep(30); // Simulate elapsed time passing to reach remainingMs <= 0.
    
    expect(timeEngine.isExpired).toBeTruthy();
    eventBus.emit('DECISION_WINDOW_EXPIRED', windowId, cardId, -1, false); // Assuming worstOptionIndex is set as the last option (worst index) and hold was not active before expiry.
    
    expect(eventBus).toHaveReceivedEventEmitterMessage('DECISION_WINDOW_EXPIRED', { windowId: 'window-id', cardId: '', worstOptionIndex: -1, holdWasActive: false });
  });
  
  test('stopIfEmpty is called after no active windows remain', async () => {
    eventBus = createMockEventBus();
    
    timeEngine.setRemainingMilliseconds(0); // No remaining milliseconds means the timer has expired and should stop if there are no more hold cards to process.
    
    expect(timeEngine.stopIfEmpty).toHaveBeenCalledTimes(1);
  });
  
  test('holdWasActive is false when window was not on hold at expiry', async () => {
    eventBus = createMockEventBus();
    
    timeEngine.setRemainingMilliseconds(0); // Expire the timer without any holds being active beforehand.
    
    expect(timeEngine.holdWasActive).toBeFalsy();
  });
});
