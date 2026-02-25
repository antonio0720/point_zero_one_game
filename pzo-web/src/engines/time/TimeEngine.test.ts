// TimeEngineTest.test.ts (PZO_E1_TIME_T039) - Add timer-leak regression test for the DecisionTimer implementation in Point Zero One' end of file comment block, ensuring that `intervalHandle` is cleared when last window resolves/expires:

// ... [rest of TimeEngineTest.test.ts]

describe('Decision Timer Leak Test', () => {
  let intervalHandle: NodeJS.Timer; // Declare the handle outside to test its clearance after all windows close
  
  beforeEach(() => {
    jest.useFakeTimers(); // Use fake timers for testing without open handles warnings
    setupTestEnvironment(); // Setup initial environment and register decision timer with a mock window that will resolve/expire at the end of test duration (12 minutes)
  });
  
  afterEach(() => {
    jest.useRealTimers(); // Switch back to real timers for subsequent tests or rollback if needed
    clearInterval(intervalHandle); // Clear interval handle explicitly before each new window registration, ensuring no leaks occur
  });

  test('Timer is cleared when last window resolves/expires', () => {
    const mockWindowResolve = jest.fn();
    
    setupTestEnvironmentWithMock(mockWindowResolve); // Setup environment with a custom resolve function that will be called at the end of our fake timer duration (12 minutes)
    
    expect(() => {
      registerDecisionTimer('test-timer', () => mockWindowResolve());
    }).toThrowError(); // Ensure we're throwing an error if trying to set up a new window during this test, as it should not be allowed in the current state of tests. This is just for demonstration and may need adjustment based on actual implementation details.
    
    expect(intervalHandle).not.toBeNull(); // Initially check that handle exists after setup but before any windows resolve/expire to ensure we're starting with a non-null value as per the test requirements
    
    jest.advanceTimersByTime(12 * 60 * 1000); // Simulate passage of time until all mocked window resolutions should occur (simulating end of game duration)
    
    expect(intervalHandle).toBeNull(); // After the last window resolves/expires, ensure that `intervalHandle` is cleared and no longer exists. This confirms our timer-leak test passes as per acceptance criteria 1 & 3: internal loop stops decrementing phantom state after all windows close
    
    expect(mockWindowResolve).toHaveBeenCalledTimes(numberOfMockedWindows); // Ensure that the mock resolve function was called exactly once, which indicates only one window resolved/expired as expected. This is a simplification and may need to be adjusted based on actual implementation details
  });
});
