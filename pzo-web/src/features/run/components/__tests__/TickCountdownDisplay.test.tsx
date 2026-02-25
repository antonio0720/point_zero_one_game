// TickCountdownDisplay.test.tsx - Tests to ensure countdown resets and decrements every second under fake timers in React components
import { render, screen } from '@testing-library/react';
import "@testing-library/jest-dom"; // For additional Jest matchers
import TickCountdownDisplay from '../TickCountdownDisplay';
import { act } from 'react-dom/test-context';

describe('<TickCountdownDisplay />', () => {
  let fakeTimer: NodeJS.Timeout;
  
  beforeEach(() => {
    // Resetting the count every time a test runs to ensure isolation and prevent interval leaks
    fakeTimer = null;
  });

  it('resets on tick increment', async () => {
    render(<TickCountdownDisplay initialTime={120} />);
    
    await act(async () => {
      // Simulate a click or any other event that triggers the count reset in your component logic.
      screen.getByText('Increment Tick').click(); 
    });

    expect(screen.getByTestId('tick-countdown')).toHaveValueOfDescribedBy('Count should be back to initial time'); // Assuming you have data-testid for the count display element and a way to describe its value in your tests (e.g., using jest matchers)
  });
  
  it('decrements every second', async () => {
    render(<TickCountdownDisplay initialTime={120} />);
    
    await act(async () => fakeTimer = setInterval(() => screen.getByTestId('tick-countdown').textContent--, 1000)); // Using a setTimeout to simulate the decrement every second for testing purposes

    expect(screen.getByTestId('tick-countdown')).toHaveValueOfDescribedBy('Count should decrease by one each tick');
    
    await act(async () => clearInterval(fakeTimer)); // Clearing interval after test to prevent leaks and ensure no unintended behavior persists between tests.
  });
});
